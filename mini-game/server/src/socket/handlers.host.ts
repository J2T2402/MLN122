import { Socket } from "socket.io";
import { roomStore } from "../rooms/store";
import { applyTransition } from "../game/engine";
import { GameMode, StationId } from "../shared/socket/events";
import { emitErrorEvent, emitModeChanged } from "./emit";

function assertHost(socket: Socket): boolean {
  if (socket.data.role === "host" && socket.data.hostAuthed === true) {
    return true;
  }
  emitErrorEvent(socket.id, "NOT_HOST", "Quyền truy cập bị từ chối. Chỉ MC mới có quyền thực hiện.", false);
  return false;
}

export function registerHostHandlers(socket: Socket): void {
  // START GAME
  socket.on("startGame", ({ roomCode }) => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(roomCode || socket.data.roomCode);
    if (room) {
      applyTransition(room, "startGame");
    }
  });

  // OPEN STATION
  socket.on("openStation", ({ station }) => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "openStation", { station: station as StationId });
    }
  });

  // START ANSWERING
  socket.on("startAnswering", ({ questionId }) => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "startAnswering", { questionId });
    }
  });

  // LOCK ANSWERS
  socket.on("lockAnswers", ({ questionId }) => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "lockAnswers", { questionId });
    }
  });

  // REVEAL ANSWER
  socket.on("revealAnswer", ({ questionId }) => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "revealAnswer", { questionId });
    }
  });

  // SHOW KNOWLEDGE CARD
  socket.on("showKnowledgeCard", ({ questionId }) => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "showKnowledgeCard", { questionId });
    }
  });

  // SHOW LEADERBOARD
  socket.on("showLeaderboard", () => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "showLeaderboard");
    }
  });

  // NEXT STATION
  socket.on("nextStation", () => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "nextStation");
    }
  });

  // START BOSS
  socket.on("startBoss", () => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "startBoss");
    }
  });

  // PAUSE GAME
  socket.on("pauseGame", () => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "pauseGame");
    }
  });

  // RESUME GAME
  socket.on("resumeGame", () => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "resumeGame");
    }
  });

  // SET MODE
  socket.on("setMode", ({ mode }) => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      room.mode = mode as GameMode;
      emitModeChanged(room, "Thay đổi bởi MC");
    }
  });

  // END GAME
  socket.on("endGame", () => {
    if (!assertHost(socket)) return;
    const room = roomStore.get(socket.data.roomCode);
    if (room) {
      applyTransition(room, "endGame");
    }
  });
}
