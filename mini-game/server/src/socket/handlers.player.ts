import { Socket } from "socket.io";
import { roomStore } from "../rooms/store";
import { TeamId, AnswerPayload } from "../shared/socket/events";
import { randomBytes, randomUUID } from "node:crypto";
import { config } from "../config/env";
import { isCleanNickname, validateAnswerPayload } from "./validate";
import {
  emitRoomState,
  emitPlayerList,
  emitTeamAssigned,
  emitAnswerAck,
  emitReactionBroadcast,
  emitErrorEvent,
  emitStationOpenedToSocket,
  emitTimerSync,
  emitAnswerRevealedPrivate,
  emitHostQuestionInfo
} from "./emit";
import { Submission, Player, Room } from "../types/domain";
import { getCurrentQuestion } from "../game/stationFlow";
import { TEAMS_DEFINITION } from "../rooms/factory";
import { applyTransition } from "../game/engine";

export function bindSocket(socket: Socket, room: Room, playerId: string, role: string) {
  socket.data.roomCode = room.roomCode;
  socket.data.playerId = playerId;
  socket.data.role = role;

  // Join Socket.io rooms
  socket.join(`room:${room.roomCode.toUpperCase()}`);
  if (role === "player") {
    socket.join(`${room.roomCode.toUpperCase()}:players`);
    const p = room.players.get(playerId);
    if (p) {
      p.socketId = socket.id;
      p.connected = true;
    }
  } else if (role === "screen") {
    socket.join(`${room.roomCode.toUpperCase()}:screens`);
  } else if (role === "host") {
    socket.join(`${room.roomCode.toUpperCase()}:host`);
    socket.data.hostAuthed = true;
  }
}

// Chọn hạm đội ÍT thành viên nhất để tự động chia đều (nếu hoà -> teamId nhỏ hơn).
function pickBalancedTeam(room: Room): TeamId {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const p of room.players.values()) {
    if (p.teamId !== null) counts[p.teamId]++;
  }
  let best: TeamId = 1;
  for (let t = 2; t <= 6; t++) {
    if (counts[t] < counts[best]) best = t as TeamId;
  }
  return best;
}

export function registerPlayerHandlers(socket: Socket): void {
  // JOIN ROOM
  socket.on("joinRoom", ({ roomCode, role, reconnectToken }, ack) => {
    const safeAck = typeof ack === "function" ? ack : () => {};
    try {
      const room = roomStore.get(roomCode);
      if (!room) {
        return safeAck({ ok: false, error: "ROOM_NOT_FOUND" });
      }

      // If reconnect token is provided, attempt to rejoin
      if (reconnectToken) {
        const found = roomStore.findPlayerByReconnectToken(reconnectToken);
        if (found && found.room.roomCode === room.roomCode) {
          const { player } = found;
          bindSocket(socket, room, player.playerId, "player");
          
          console.log(`Player ${player.nickname} rejoined room ${room.roomCode} via token`);
          
          safeAck({ ok: true, playerId: player.playerId, reconnectToken });
          emitRoomState(room);
          emitPlayerList(room);
          
          // Re-send the active question if they rejoin while one is on screen (STATION_OPEN,
          // ANSWERING, BOSS_INTRO, BOSS_ANSWERING) so they never get stuck on the loading spinner.
          if (
            room.currentQuestionId &&
            (room.phase === "STATION_OPEN" || room.phase === "ANSWERING" ||
             room.phase === "BOSS_INTRO" || room.phase === "BOSS_ANSWERING")
          ) {
            emitStationOpenedToSocket(room, socket.id, player.playerId);
            // Timer only exists once answering has started.
            if (room.deadlineTs && (room.phase === "ANSWERING" || room.phase === "BOSS_ANSWERING")) {
              const remainingSec = Math.max(0, room.deadlineTs - Date.now()) / 1000;
              emitTimerSync(room, remainingSec);
            }

            // Send answerAck if they already submitted
            const subMap = room.submissions.get(room.currentQuestionId || "");
            const playerSub = subMap?.get(player.playerId);
            if (playerSub) {
              emitAnswerAck(socket.id, room.currentQuestionId || "", playerSub.serverReceivedAt);
            }
          }
          return;
        }
      }

      // Check Host authentication
      if (role === "host") {
        const token = socket.handshake.auth?.hostToken || socket.handshake.headers?.hosttoken;
        if (token !== room.hostSecret) {
          return safeAck({ ok: false, error: "BAD_HOST_TOKEN" });
        }
        
        bindSocket(socket, room, "host", "host");
        console.log(`Host joined room ${room.roomCode}`);
        safeAck({ ok: true });
        emitRoomState(room);
        emitPlayerList(room);
        // Restore the MC answer-preview if the host (re)joins mid-question.
        if (room.currentQuestionId) emitHostQuestionInfo(room);
        return;
      }

      // Screen role join
      if (role === "screen") {
        bindSocket(socket, room, "screen", "screen");
        console.log(`Screen display joined room ${room.roomCode}`);
        safeAck({ ok: true });
        emitRoomState(room);
        emitPlayerList(room);
        return;
      }

      // Player role join
      if (role === "player") {
        // Enforce max players
        const activePlayersCount = Array.from(room.players.values()).filter(p => p.connected).length;
        if (activePlayersCount >= config.maxPlayers) {
          return safeAck({ ok: false, error: "ROOM_FULL" });
        }

        const playerId = randomUUID ? randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
        const newReconnectToken = randomBytes ? randomBytes(16).toString("hex") : Math.random().toString(36).substring(2);

        const player: Player = {
          playerId,
          socketId: socket.id,
          nickname: `Thủy Thủ ${Math.floor(1000 + Math.random() * 9000)}`, // temporary safe name
          teamId: null,
          reconnectToken: newReconnectToken,
          score: 0,
          streak: 0,
          connected: true,
          submissionsByQuestion: new Map(),
          joinedAt: Date.now(),
        };

        room.players.set(playerId, player);
        bindSocket(socket, room, playerId, "player");

        // Tự động xếp người chơi vào hạm đội ít người nhất (chia đều) — thay cho việc tự chọn đội.
        const assignedTeam = pickBalancedTeam(room);
        player.teamId = assignedTeam;
        const assignedDef = TEAMS_DEFINITION[assignedTeam];

        console.log(`Player ${player.nickname} joined room ${room.roomCode} -> auto team ${assignedDef.name}`);
        safeAck({ ok: true, playerId, reconnectToken: newReconnectToken });
        emitRoomState(room);
        emitTeamAssigned(socket.id, playerId, assignedTeam, assignedDef.name);
        emitPlayerList(room);
        return;
      }

      safeAck({ ok: false, error: "INVALID_ROLE" });
    } catch (err: any) {
      console.error("Error in joinRoom handler:", err);
      emitErrorEvent(socket.id, "JOIN_ERROR", err.message || "Unknown error", false);
    }
  });

  // SET NICKNAME
  socket.on("setNickname", ({ nickname, avatar }) => {
    try {
      const { roomCode, playerId, role } = socket.data;
      if (!roomCode || !playerId || role !== "player") return;

      const room = roomStore.get(roomCode);
      if (!room) return;

      const player = room.players.get(playerId);
      if (!player) return;

      let cleanName = nickname.trim();
      if (cleanName.length < 2 || cleanName.length > 16 || !isCleanNickname(cleanName)) {
        cleanName = `Thủy Thủ ${Math.floor(100 + Math.random() * 900)}`; // reset to fallback if invalid/offensive
        emitErrorEvent(socket.id, "INVALID_NICKNAME", "Nickname không hợp lệ hoặc chứa từ cấm.", false);
      }

      // Check if nickname already exists in room
      let finalName = cleanName;
      let suffix = 1;
      const otherNames = Array.from(room.players.values())
        .filter(p => p.playerId !== playerId)
        .map(p => p.nickname.toLowerCase());
      
      while (otherNames.includes(finalName.toLowerCase())) {
        finalName = `${cleanName} (${suffix})`;
        suffix++;
      }

      player.nickname = finalName;
      if (avatar) player.avatar = avatar;

      console.log(`Player ID ${playerId} set nickname to ${player.nickname}`);
      emitPlayerList(room);
    } catch (err: any) {
      console.error("Error in setNickname:", err);
    }
  });

  // SUBMIT ANSWER
  socket.on("submitAnswer", ({ questionId, answer, clientSentAt }, ack) => {
    const safeAck = typeof ack === "function" ? ack : () => {};
    try {
      const { roomCode, playerId, role } = socket.data;
      if (!roomCode || !playerId || role !== "player") {
        return safeAck({ ok: false, received: false, error: "UNAUTHORIZED" });
      }

      const room = roomStore.get(roomCode);
      if (!room) {
        return safeAck({ ok: false, received: false, error: "ROOM_NOT_FOUND" });
      }

      if (room.phase !== "ANSWERING" && room.phase !== "BOSS_ANSWERING") {
        return safeAck({ ok: false, received: false, error: "NOT_ANSWERING" });
      }

      if (questionId !== room.currentQuestionId) {
        return safeAck({ ok: false, received: false, error: "STALE_QUESTION" });
      }

      // Enforce deadline
      const serverTime = Date.now();
      const deadline = room.deadlineTs || 0;
      if (serverTime > deadline + config.timerGraceMs) {
        return safeAck({ ok: false, received: false, error: "DEADLINE_PASSED" });
      }

      const player = room.players.get(playerId);
      if (!player || player.teamId === null) {
        return safeAck({ ok: false, received: false, error: "TEAM_REQUIRED" });
      }

      const q = getCurrentQuestion(room);
      if (!q || !validateAnswerPayload(q.type, answer)) {
        return safeAck({ ok: false, received: false, error: "INVALID_ANSWER" });
      }

      // Check idempotency: check if player already submitted this question
      let subMap = room.submissions.get(questionId);
      if (!subMap) {
        subMap = new Map<string, Submission>();
        room.submissions.set(questionId, subMap);
      }

      if (subMap.has(playerId)) {
        // Already submitted, return previous receive state to prevent double grading
        console.log(`Idempotent submission ignored for player ${player.nickname}, question ${questionId}`);
        safeAck({ ok: true, received: true });
        const existingSub = subMap.get(playerId)!;
        emitAnswerAck(socket.id, questionId, existingSub.serverReceivedAt);
        return;
      }

      // Rate limit submit
      const lastSub = player.submissionsByQuestion.get(questionId);
      if (lastSub && (serverTime - lastSub.serverReceivedAt) < config.rateLimitSubmitMs) {
        return safeAck({ ok: false, received: false, error: "RATE_LIMITED" });
      }

      const submission: Submission = {
        playerId,
        questionId,
        answer,
        isCorrect: false,
        correctRatio: 0,
        responseMs: Math.max(0, deadline - serverTime), // time remaining
        pointsEarned: 0,
        serverReceivedAt: serverTime,
        clientSentAt: clientSentAt || serverTime,
      };

      subMap.set(playerId, submission);
      
      console.log(`Player ${player.nickname} submitted answer for ${questionId}`);
      
      safeAck({ ok: true, received: true });
      emitAnswerAck(socket.id, questionId, serverTime);

      // Auto-lock check: if all active players in teams have submitted, lock early
      const totalTeamPlayers = Array.from(room.players.values()).filter(p => p.connected && p.teamId !== null).length;
      if (subMap.size >= totalTeamPlayers && totalTeamPlayers > 0) {
        console.log(`All players submitted. Locking room ${room.roomCode} early.`);
        // Run lock transition
        applyTransition(room, "lockAnswers");
      }
    } catch (err: any) {
      console.error("Error in submitAnswer:", err);
      safeAck({ ok: false, received: false, error: "SERVER_ERROR" });
    }
  });

  // SEND REACTION
  socket.on("sendReaction", ({ emoji }) => {
    try {
      const { roomCode, playerId, role } = socket.data;
      if (!roomCode) return;

      const room = roomStore.get(roomCode);
      if (!room) return;

      // Rate limiting reactions on server side
      const socketData = socket.data as any;
      const lastReact = socketData.lastReactTime || 0;
      if ((Date.now() - lastReact) < config.rateLimitReactMs) {
        return;
      }
      socketData.lastReactTime = Date.now();

      let teamId: TeamId | null = null;
      let nickname: string | undefined;

      if (role === "player" && playerId) {
        const player = room.players.get(playerId);
        if (player) {
          teamId = player.teamId;
          nickname = player.nickname;
        }
      }

      emitReactionBroadcast(room, emoji, teamId, nickname);
    } catch (err: any) {
      console.error("Error in sendReaction:", err);
    }
  });

  // REJOIN
  socket.on("rejoin", ({ reconnectToken }, ack) => {
    const safeAck = typeof ack === "function" ? ack : () => {};
    try {
      const found = roomStore.findPlayerByReconnectToken(reconnectToken);
      if (!found) {
        return safeAck({ ok: false, error: "BAD_TOKEN" });
      }

      const { room, player } = found;
      bindSocket(socket, room, player.playerId, "player");
      
      console.log(`Socket rejoined room ${room.roomCode} as Player ${player.nickname}`);
      
      safeAck({ ok: true });
      emitRoomState(room);
      emitPlayerList(room);

      // Restore the active question whenever one is on screen (not only while answering).
      if (
        room.currentQuestionId &&
        (room.phase === "STATION_OPEN" || room.phase === "ANSWERING" ||
         room.phase === "BOSS_INTRO" || room.phase === "BOSS_ANSWERING")
      ) {
        emitStationOpenedToSocket(room, socket.id, player.playerId);
        if (room.deadlineTs && (room.phase === "ANSWERING" || room.phase === "BOSS_ANSWERING")) {
          const remainingSec = Math.max(0, room.deadlineTs - Date.now()) / 1000;
          emitTimerSync(room, remainingSec);
        }

        const subMap = room.submissions.get(room.currentQuestionId || "");
        const playerSub = subMap?.get(player.playerId);
        if (playerSub) {
          emitAnswerAck(socket.id, room.currentQuestionId || "", playerSub.serverReceivedAt);
        }
      }
    } catch (err: any) {
      console.error("Error in rejoin:", err);
      safeAck({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // DISCONNECT HANDLER
  socket.on("disconnect", () => {
    try {
      const { roomCode, playerId, role } = socket.data;
      if (!roomCode) return;

      const room = roomStore.get(roomCode);
      if (!room) return;

      if (role === "player" && playerId) {
        const player = room.players.get(playerId);
        if (player) {
          player.socketId = null;
          player.connected = false;
          console.log(`Player ${player.nickname} disconnected from room ${room.roomCode}`);
          emitPlayerList(room);
        }
      }
    } catch (err: any) {
      console.error("Error in player disconnect:", err);
    }
  });
}
