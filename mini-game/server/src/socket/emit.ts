import { Server } from "socket.io";
import { Room, Player } from "../types/domain";
import { TeamId, StationId, GamePhase } from "../shared/socket/events";
import { getQuestionPublic, getQuestionFull } from "../questions/repo";
import { buildAnswerText } from "../questions/mapper";
import { countConnectedPlayers } from "../rooms/janitor";
import { shuffleQuestionForPlayer } from "./shuffle";
import { hasMoreQuestionsInStation } from "../game/stationFlow";

let io: Server;

export function initEmitter(ioInstance: Server): void {
  io = ioInstance;
}

// Room logic shortcuts
const toAll = (roomCode: string) => io.to(`room:${roomCode.toUpperCase()}`);
const toPlayers = (roomCode: string) => io.to(`${roomCode.toUpperCase()}:players`);
const toScreens = (roomCode: string) => io.to(`${roomCode.toUpperCase()}:screens`);
const toHost = (roomCode: string) => io.to(`${roomCode.toUpperCase()}:host`);
const toSocket = (socketId: string) => io.to(socketId);

export function emitRoomState(room: Room): void {
  toAll(room.roomCode).emit("roomState", {
    roomCode: room.roomCode,
    phase: room.phase,
    mode: room.mode,
    currentStation: room.currentStation,
    currentQuestionId: room.currentQuestionId,
    serverNow: Date.now(),
    resumePhase: room.resumePhase || undefined,
    hasMoreInStation:
      room.currentStation !== null && room.currentStation !== "boss"
        ? hasMoreQuestionsInStation(room, room.currentStation)
        : false,
  });
}

export function emitPlayerList(room: Room): void {
  const players = Array.from(room.players.values()).map(p => ({
    playerId: p.playerId,
    nickname: p.nickname,
    avatar: p.avatar,
    teamId: p.teamId,
    connected: p.connected,
    score: p.score,
  }));

  const perTeam: Record<TeamId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const p of room.players.values()) {
    if (p.teamId !== null) {
      perTeam[p.teamId]++;
    }
  }

  toAll(room.roomCode).emit("playerList", {
    players,
    counts: {
      total: room.players.size,
      connected: countConnectedPlayers(room),
      perTeam,
    },
  });
}

export function emitTeamAssigned(socketId: string, playerId: string, teamId: TeamId, teamName: string): void {
  toSocket(socketId).emit("teamAssigned", {
    playerId,
    teamId,
    teamName,
  });
}

function stationPhase(room: Room): "STATION_OPEN" | "ANSWERING" | "BOSS_ANSWERING" {
  return room.phase === "BOSS_ANSWERING" ? "BOSS_ANSWERING" : room.phase === "STATION_OPEN" ? "STATION_OPEN" : "ANSWERING";
}

export function emitStationOpened(room: Room): void {
  if (!room.currentQuestionId) return;
  const publicQ = getQuestionPublic(room.currentQuestionId);
  if (!publicQ) return;

  const phase = stationPhase(room);

  // Players each receive their OWN shuffled ordering (anti-cheat #27) so peeking at a
  // neighbour's screen or memorising "the answer is B" no longer works. Grading is id-based,
  // so re-ordering is transparent to scoring and the reveal stats.
  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    toSocket(player.socketId).emit("stationOpened", {
      question: shuffleQuestionForPlayer(publicQ, player.playerId),
      phase,
    });
  }

  // Projector + host console see the canonical order (shared reference view).
  toScreens(room.roomCode).emit("stationOpened", { question: publicQ, phase });
  toHost(room.roomCode).emit("stationOpened", { question: publicQ, phase });

  // MC-only correct-answer preview (answers never leave the server for players/screen).
  emitHostQuestionInfo(room);
}

// HOST-ONLY: push the current question's correct answer + explanation to the host room.
// Keeps answers off the client bundle entirely (NFR4) while restoring the MC preview panel.
export function emitHostQuestionInfo(room: Room): void {
  if (!room.currentQuestionId) return;
  const full = getQuestionFull(room.currentQuestionId);
  if (!full) return;
  toHost(room.roomCode).emit("hostQuestionInfo", {
    questionId: full.id,
    type: full.type,
    prompt: full.prompt,
    answerText: buildAnswerText(full),
    explain: full.explain,
  });
}

// Re-send the active question to ONE socket only (reconnect / STATION_OPEN restore). Emitting to
// the whole room here would reset every other player's in-progress answer, so we target just the
// reconnecting socket and give a player their deterministic shuffled order.
export function emitStationOpenedToSocket(room: Room, socketId: string, playerId?: string): void {
  if (!room.currentQuestionId) return;
  const publicQ = getQuestionPublic(room.currentQuestionId);
  if (!publicQ) return;
  const question = playerId ? shuffleQuestionForPlayer(publicQ, playerId) : publicQ;
  toSocket(socketId).emit("stationOpened", { question, phase: stationPhase(room) });
}

export function emitTimerSync(room: Room, durationSec: number): void {
  if (!room.currentQuestionId || room.deadlineTs === null) return;
  
  toAll(room.roomCode).emit("timerSync", {
    questionId: room.currentQuestionId,
    deadlineTs: room.deadlineTs,
    serverNow: Date.now(),
    durationSec,
  });
}

export function emitAnswerLocked(room: Room, qId: string): void {
  const answeredCount = room.submissions.get(qId)?.size || 0;
  const totalPlayers = Array.from(room.players.values()).filter(p => p.teamId !== null).length;

  toAll(room.roomCode).emit("answerLocked", {
    questionId: qId,
    answeredCount,
    totalPlayers,
  });
}

export function emitAnswerRevealedCommon(room: Room, qId: string, type: any, correct: any, stats: any): void {
  toScreens(room.roomCode).emit("answerRevealed", {
    questionId: qId,
    type,
    correct,
    stats,
  });
  
  // Players who did not submit anything also get the common event
  const questionSubMap = room.submissions.get(qId);
  for (const player of room.players.values()) {
    if (player.teamId === null) continue;
    if (!questionSubMap || !questionSubMap.has(player.playerId)) {
      if (player.socketId) {
        toSocket(player.socketId).emit("answerRevealed", {
          questionId: qId,
          type,
          correct,
          stats,
        });
      }
    }
  }
}

export function emitAnswerRevealedPrivate(socketId: string, qId: string, type: any, correct: any, stats: any, yourResult: any): void {
  toSocket(socketId).emit("answerRevealed", {
    questionId: qId,
    type,
    correct,
    stats,
    yourResult,
  });
}

export function emitKnowledgeCard(room: Room, qId: string, card: any, explain: string): void {
  toAll(room.roomCode).emit("knowledgeCard", {
    questionId: qId,
    explain,
    knowledgeCard: card,
  });
}

export function emitLeaderboardUpdate(room: Room, data: any): void {
  toAll(room.roomCode).emit("leaderboardUpdate", data);
}

export function emitBossPhase(room: Room, phase: "BOSS_INTRO" | "BOSS_ANSWERING" | "BOSS_REVEAL"): void {
  toAll(room.roomCode).emit("bossPhase", {
    phase,
    pointsMultiplier: 2,
    title: "Cơn Bão Nhà Ở Xã Hội",
  });
}

export function emitModeChanged(room: Room, reason?: string): void {
  toAll(room.roomCode).emit("modeChanged", {
    mode: room.mode,
    reason,
  });
}

export function emitGameEnded(room: Room, data: any): void {
  toAll(room.roomCode).emit("gameEnded", data);
}

export function emitAnswerAck(socketId: string, qId: string, serverReceivedAt: number): void {
  toSocket(socketId).emit("answerAck", {
    questionId: qId,
    received: true,
    serverReceivedAt,
  });
}

export function emitReactionBroadcast(room: Room, emoji: string, teamId: TeamId | null, nickname?: string): void {
  toAll(room.roomCode).emit("reactionBroadcast", {
    emoji,
    teamId,
    nickname,
  });
}

export function emitErrorEvent(socketId: string, code: string, message: string, fatal: boolean): void {
  toSocket(socketId).emit("errorEvent", {
    code,
    message,
    fatal,
  });
}
