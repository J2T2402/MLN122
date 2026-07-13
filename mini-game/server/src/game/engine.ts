import { Room, Submission, Player } from "../types/domain";
import { QuestionFull } from "../types/question";
import { GamePhase, GameMode, StationId } from "../shared/socket/events";
import { isValidTransition, getNextPhase } from "./stateMachine";
import { initializeStation, advanceQuestionInStation, getCurrentQuestion } from "./stationFlow";
import { armTimer, pauseTimer, resumeTimer } from "./timer";
import { clearRoomTimer } from "../rooms/janitor";
import { gradeAnswer } from "../scoring/grade";
import { calculatePoints } from "../scoring/points";
import { getLeaderboard } from "../scoring/leaderboard";

// Broadcaster callback injected from socket gateway
export let broadcastRoomState: (room: Room) => void = () => {};
export let broadcastStationOpened: (room: Room) => void = () => {};
export let broadcastTimerSync: (room: Room, durationSec: number) => void = () => {};
export let broadcastAnswerLocked: (room: Room, qId: string) => void = () => {};
export let broadcastAnswerRevealed: (room: Room, qId: string, stats: any, correct: any) => void = () => {};
export let sendPrivateResult: (room: Room, playerId: string, result: any) => void = () => {};
export let broadcastKnowledgeCard: (room: Room, qId: string, card: any, explain: string) => void = () => {};
export let broadcastLeaderboard: (room: Room, data: any) => void = () => {};
export let broadcastBossPhase: (room: Room, phase: "BOSS_INTRO" | "BOSS_ANSWERING" | "BOSS_REVEAL") => void = () => {};
export let broadcastGameEnded: (room: Room, data: any) => void = () => {};

export function registerBroadcasters(callbacks: {
  broadcastRoomState: typeof broadcastRoomState;
  broadcastStationOpened: typeof broadcastStationOpened;
  broadcastTimerSync: typeof broadcastTimerSync;
  broadcastAnswerLocked: typeof broadcastAnswerLocked;
  broadcastAnswerRevealed: typeof broadcastAnswerRevealed;
  sendPrivateResult: typeof sendPrivateResult;
  broadcastKnowledgeCard: typeof broadcastKnowledgeCard;
  broadcastLeaderboard: typeof broadcastLeaderboard;
  broadcastBossPhase: typeof broadcastBossPhase;
  broadcastGameEnded: typeof broadcastGameEnded;
}) {
  broadcastRoomState = callbacks.broadcastRoomState;
  broadcastStationOpened = callbacks.broadcastStationOpened;
  broadcastTimerSync = callbacks.broadcastTimerSync;
  broadcastAnswerLocked = callbacks.broadcastAnswerLocked;
  broadcastAnswerRevealed = callbacks.broadcastAnswerRevealed;
  sendPrivateResult = callbacks.sendPrivateResult;
  broadcastKnowledgeCard = callbacks.broadcastKnowledgeCard;
  broadcastLeaderboard = callbacks.broadcastLeaderboard;
  broadcastBossPhase = callbacks.broadcastBossPhase;
  broadcastGameEnded = callbacks.broadcastGameEnded;
}

// Timeout handler triggered when server-side countdown expires
export function handleTimerTimeout(room: Room, questionId: string): void {
  console.log(`Timer expired for room ${room.roomCode}, question ${questionId}`);
  if (room.phase === "ANSWERING" || room.phase === "BOSS_ANSWERING") {
    applyTransition(room, "lockAnswers", { questionId });
  }
}

export function scoreQuestion(room: Room, qId: string): { stats: any; correct: any } {
  const q = room.questionsBank.get(qId);
  if (!q) {
    throw new Error(`Question ${qId} not found in room bank.`);
  }

  // Get or create submissions map for this question
  let questionSubMap = room.submissions.get(qId);
  if (!questionSubMap) {
    questionSubMap = new Map<string, Submission>();
    room.submissions.set(qId, questionSubMap);
  }

  const answeredCount = questionSubMap.size;

  let correctCount = 0;

  // MCQ and SelectWrong option frequencies
  const optionCounts: Record<string, number> = {};
  if (q.options) {
    for (const opt of q.options) {
      optionCounts[opt.id] = 0;
    }
  }

  // True/false statement correct counters
  const statementCorrectCounts: Record<string, number> = {};
  if (q.statements) {
    for (const stmt of q.statements) {
      statementCorrectCounts[stmt.id] = 0;
    }
  }

  // Drag/drop matching item correct counters
  const itemCorrectCounts: Record<string, number> = {};
  if (q.items) {
    for (const item of q.items) {
      itemCorrectCounts[item.id] = 0;
    }
  }

  // PASS 1) Grade everyone, update scores/streaks, and accumulate class aggregates.
  //         Private results are held until pass 2 so every player receives the SAME
  //         FINAL statistics (computing them mid-loop understated the numbers for all
  //         but the last-processed player).
  const perPlayer: { playerId: string; yourResult: any }[] = [];
  for (const player of room.players.values()) {
    if (player.teamId === null) continue; // skip hosts/screens/unassigned players

    const sub = questionSubMap.get(player.playerId);

    if (sub) {
      const gradeResult = gradeAnswer(q, sub.answer);
      sub.isCorrect = gradeResult.isCorrect;
      sub.correctRatio = gradeResult.correctRatio;

      if (gradeResult.isCorrect) {
        correctCount++;
      }

      // Use the response time captured at SUBMIT time (pause-safe). Recomputing from the
      // live deadlineTs here inflated the speed bonus whenever the round had been paused,
      // because pause/resume rewrites deadlineTs.
      const remainingMs = sub.responseMs;
      const scoreResult = calculatePoints(
        q,
        gradeResult,
        player.streak,
        remainingMs,
        room.durationSec
      );

      sub.pointsEarned = scoreResult.pointsEarned;
      player.score += scoreResult.pointsEarned;
      player.streak = scoreResult.newStreak;

      // Track player submission details
      player.submissionsByQuestion.set(qId, sub);

      // Aggregate statistics based on type
      if (q.type === "mcq" || q.type === "selectwrong") {
        const optionId = (sub.answer as any).optionId;
        if (optionId && optionCounts[optionId] !== undefined) {
          optionCounts[optionId]++;
        }
      } else if (q.type === "truefalse") {
        const answers = (sub.answer as any).answers || {};
        for (const stmt of q.statements || []) {
          if (answers[stmt.id] === stmt.isTrue) {
            statementCorrectCounts[stmt.id]++;
          }
        }
      } else if (q.type === "dragdrop" || q.type === "matching") {
        const placement = (sub.answer as any).placement || {};
        for (const item of q.items || []) {
          if (placement[item.id] === item.correctBucket) {
            itemCorrectCounts[item.id]++;
          }
        }
      }

      perPlayer.push({
        playerId: player.playerId,
        yourResult: {
          isCorrect: sub.isCorrect,
          pointsEarned: sub.pointsEarned,
          speedBonus: scoreResult.speedBonus,
          streak: player.streak,
        },
      });
    } else {
      // Player did not submit -> reset streak
      player.streak = 0;
      perPlayer.push({
        playerId: player.playerId,
        yourResult: { isCorrect: false, pointsEarned: 0, speedBonus: 0, streak: 0 },
      });
    }
  }

  // 2) Formulate final class stats ONCE, after all grading is complete.
  const classCorrectPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const stats = {
    optionPct: getPercentages(optionCounts, answeredCount),
    statementCorrectPct: getPercentages(statementCorrectCounts, answeredCount),
    bucketCorrectPct: getPercentages(itemCorrectCounts, answeredCount),
    classCorrectPct,
  };

  const correct = getPublicCorrectObject(q);

  // PASS 3) Now send every player their private result carrying the FINAL stats.
  for (const pr of perPlayer) {
    sendPrivateResult(room, pr.playerId, {
      questionId: qId,
      type: q.type,
      correct,
      stats,
      yourResult: pr.yourResult,
    });
  }

  return { stats, correct };
}

function getPercentages(counts: Record<string, number>, total: number): Record<string, number> {
  const pcts: Record<string, number> = {};
  for (const [id, count] of Object.entries(counts)) {
    pcts[id] = total > 0 ? Math.round((count / total) * 100) : 0;
  }
  return pcts;
}

function getPublicCorrectObject(q: QuestionFull): any {
  if (q.type === "mcq") {
    return { optionId: q.correct };
  }
  if (q.type === "selectwrong") {
    return { wrongOptionId: q.correct };
  }
  if (q.type === "truefalse") {
    const statements: Record<string, boolean> = {};
    for (const stmt of q.statements || []) {
      statements[stmt.id] = stmt.isTrue;
    }
    return { statements };
  }
  if (q.type === "dragdrop" || q.type === "matching") {
    const placement: Record<string, string> = {};
    for (const item of q.items || []) {
      placement[item.id] = item.correctBucket;
    }
    return { placement };
  }
  return {};
}

export function applyTransition(
  room: Room,
  action: string,
  payload?: any
): GamePhase {
  if (!isValidTransition(room.phase, action as any)) {
    console.warn(`Invalid transition attempted: ${room.phase} --(${action})--> ?`);
    return room.phase;
  }

  room.lastActivityAt = Date.now();
  const nextPhase = getNextPhase(room.phase, action);
  
  if (!nextPhase) {
    return room.phase;
  }

  const prevPhase = room.phase;
  room.phase = nextPhase;

  console.log(`Room ${room.roomCode} transition: ${prevPhase} --(${action})--> ${room.phase}`);

  // Handle transition side-effects
  switch (action) {
    case "startGame":
      broadcastRoomState(room);
      break;

    case "openStation": {
      const station = payload?.station as StationId;
      // Re-opening the SAME station right after a reveal advances to the next question in that
      // station (this is what wires up the "1–2 câu/trạm" flow). Opening a fresh station
      // initialises it to its first question. advanceQuestionInStation is a no-op when the
      // station has no further questions, so we simply stay on the last one instead of looping
      // back to question 1.
      const reopeningSameStation =
        room.currentStation === station &&
        (prevPhase === "REVEAL" || prevPhase === "KNOWLEDGE_CARD");
      if (reopeningSameStation) {
        advanceQuestionInStation(room, station);
      } else {
        initializeStation(room, station);
      }
      broadcastRoomState(room);
      broadcastStationOpened(room);
      break;
    }

    case "startAnswering": {
      const q = getCurrentQuestion(room);
      if (q) {
        const timeLimit = q.timeLimitSec;
        armTimer(room, q.id, timeLimit, handleTimerTimeout);
        broadcastRoomState(room);
        broadcastTimerSync(room, timeLimit);

        if (room.phase === "BOSS_ANSWERING") {
          broadcastBossPhase(room, "BOSS_ANSWERING");
        }
      }
      break;
    }

    case "lockAnswers": {
      clearRoomTimer(room);
      broadcastRoomState(room);
      const qId = room.currentQuestionId || "";
      const answeredCount = room.submissions.get(qId)?.size || 0;
      const totalPlayers = Array.from(room.players.values()).filter(p => p.teamId !== null).length;
      
      broadcastAnswerLocked(room, qId);
      break;
    }

    case "revealAnswer": {
      const qId = room.currentQuestionId || "";
      // A boss question must always end in BOSS_REVEAL so the projector shows the "chốt Boss ×2"
      // cue. Reveal can arrive from BOSS_ANSWERING directly (already BOSS_REVEAL) OR from the
      // generic LOCKED phase after an auto-lock (would otherwise be plain REVEAL) — normalise here.
      if (room.currentStation === "boss") {
        room.phase = "BOSS_REVEAL";
      }
      const { stats, correct } = scoreQuestion(room, qId);

      broadcastRoomState(room);
      broadcastAnswerRevealed(room, qId, stats, correct);

      if (room.phase === "BOSS_REVEAL") {
        broadcastBossPhase(room, "BOSS_REVEAL");
      }
      break;
    }

    case "showKnowledgeCard": {
      const q = getCurrentQuestion(room);
      if (q) {
        broadcastRoomState(room);
        const cardPayload = {
          title: `Thẻ Tri Thức - ${q.stationName}`,
          body: typeof q.knowledgeCard === "string" ? q.knowledgeCard : (q.knowledgeCard as any).body || "",
          badge: room.currentStation ? {
            1: "Nhà Thông Thái",
            2: "Thủy Thủ Vượt Sóng",
            3: "Nhà Kinh Tế",
            4: "Chuyên Gia Thể Chế",
            "boss": "Anh Hùng Vượt Bão",
          }[room.currentStation] || "Thủy Thủ" : "Thủy Thủ",
          station: room.currentStation!,
        };
        broadcastKnowledgeCard(room, q.id, cardPayload, q.explain);
      }
      break;
    }

    case "showLeaderboard": {
      broadcastRoomState(room);
      const board = getLeaderboard(room);
      broadcastLeaderboard(room, board);
      break;
    }

    case "nextStation": {
      // Bug-fix (#2): the boss is the final station. Without this guard, calling
      // nextStation while on the boss falls through to the default `nextStation = 1`
      // and silently loops the whole game back to Station 1. Treat it as a no-op
      // (the host should use endGame after the boss) by reverting the phase.
      if (room.currentStation === "boss") {
        room.phase = prevPhase;
        break;
      }
      // Get the next station
      let nextStation: StationId = 1;
      if (room.currentStation === 1) nextStation = 2;
      else if (room.currentStation === 2) nextStation = 3;
      else if (room.currentStation === 3) nextStation = 4;
      else if (room.currentStation === 4) nextStation = "boss";

      initializeStation(room, nextStation);
      room.phase = "STATION_OPEN";
      broadcastRoomState(room);
      broadcastStationOpened(room);
      break;
    }

    case "startBoss": {
      initializeStation(room, "boss");
      room.phase = "BOSS_INTRO";
      broadcastRoomState(room);
      broadcastStationOpened(room); // deliver boss question so it's ready when answering begins
      broadcastBossPhase(room, "BOSS_INTRO");
      break;
    }

    case "pauseGame": {
      room.resumePhase = prevPhase;
      pauseTimer(room);
      broadcastRoomState(room);
      break;
    }

    case "resumeGame": {
      const resumeTo = room.resumePhase || "LOBBY";
      room.phase = resumeTo;
      room.resumePhase = null;
      
      broadcastRoomState(room);

      // If we resumed back to an answering state, re-send question + re-arm the timer
      if ((resumeTo === "ANSWERING" || resumeTo === "BOSS_ANSWERING") && room.currentQuestionId) {
        broadcastStationOpened(room);
        const remainingMs = resumeTimer(room, room.currentQuestionId, handleTimerTimeout);
        if (remainingMs !== null) {
          broadcastTimerSync(room, remainingMs / 1000);
        }
      }
      break;
    }

    case "endGame": {
      room.phase = "VICTORY";
      room.closedAt = Date.now();
      
      const board = getLeaderboard(room);
      
      // Winner team is the team with highest score
      let winnerTeam = board.teams[0] || { teamId: 1, teamName: "Hồng San Hô", score: 0 };
      const topPlayers = board.players.map(p => ({ playerId: p.playerId, nickname: p.nickname, score: p.score, teamId: p.teamId }));
      const finalTeams = board.teams.map(t => ({ teamId: t.teamId, score: t.score, rank: t.rank }));

      broadcastRoomState(room);
      broadcastGameEnded(room, {
        winnerTeam: { teamId: winnerTeam.teamId, teamName: winnerTeam.teamName, score: winnerTeam.score },
        topPlayers,
        finalTeams,
      });

      // Instantly auto-advance to ENDED state
      setTimeout(() => {
        room.phase = "ENDED";
        broadcastRoomState(room);
      }, 1000);
      break;
    }
  }

  return room.phase;
}
