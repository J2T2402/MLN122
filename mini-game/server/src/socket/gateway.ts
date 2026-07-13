import { Server, Socket } from "socket.io";
import { initEmitter } from "./emit";
import { registerPlayerHandlers } from "./handlers.player";
import { registerHostHandlers } from "./handlers.host";
import { registerBroadcasters } from "../game/engine";
import { Room } from "../types/domain";
import {
  emitRoomState,
  emitStationOpened,
  emitTimerSync,
  emitAnswerLocked,
  emitAnswerRevealedCommon,
  emitAnswerRevealedPrivate,
  emitKnowledgeCard,
  emitLeaderboardUpdate,
  emitBossPhase,
  emitGameEnded
} from "./emit";

export function initSocketGateway(io: Server): void {
  // Initialize standard emitter module
  initEmitter(io);

  // Link GameEngine callback hooks to socket emitters
  registerBroadcasters({
    broadcastRoomState: (room: Room) => {
      emitRoomState(room);
    },
    broadcastStationOpened: (room: Room) => {
      emitStationOpened(room);
    },
    broadcastTimerSync: (room: Room, durationSec: number) => {
      emitTimerSync(room, durationSec);
    },
    broadcastAnswerLocked: (room: Room, qId: string) => {
      emitAnswerLocked(room, qId);
    },
    broadcastAnswerRevealed: (room: Room, qId: string, stats: any, correct: any) => {
      emitAnswerRevealedCommon(room, qId, room.questionsBank.get(qId)?.type, correct, stats);
    },
    sendPrivateResult: (room: Room, playerId: string, result: any) => {
      const p = room.players.get(playerId);
      if (p && p.socketId) {
        emitAnswerRevealedPrivate(
          p.socketId,
          result.questionId,
          result.type,
          result.correct,
          result.stats,
          result.yourResult
        );
      }
    },
    broadcastKnowledgeCard: (room: Room, qId: string, card: any, explain: string) => {
      emitKnowledgeCard(room, qId, card, explain);
    },
    broadcastLeaderboard: (room: Room, data: any) => {
      emitLeaderboardUpdate(room, data);
    },
    broadcastBossPhase: (room: Room, phase: "BOSS_INTRO" | "BOSS_ANSWERING" | "BOSS_REVEAL") => {
      emitBossPhase(room, phase);
    },
    broadcastGameEnded: (room: Room, data: any) => {
      emitGameEnded(room, data);
    },
  });

  // Client connection handler
  io.on("connection", (socket: Socket) => {
    // Register role-specific command listeners
    registerPlayerHandlers(socket);
    registerHostHandlers(socket);
  });
}
