import { Room } from "../types/domain";
import { roomStore } from "./store";
import { config } from "../config/env";

export function countConnectedPlayers(room: Room): number {
  let count = 0;
  for (const player of room.players.values()) {
    if (player.connected) {
      count++;
    }
  }
  return count;
}

export function clearRoomTimer(room: Room): void {
  if (room.timerHandle) {
    clearTimeout(room.timerHandle);
    room.timerHandle = undefined;
  }
}

export function startJanitor(): void {
  const intervalMs = config.room.janitorMs;
  
  console.log(`Starting room janitor. Interval: ${intervalMs / 1000}s`);
  
  setInterval(() => {
    const now = Date.now();
    const store = roomStore;

    for (const room of store.all()) {
      const idleTime = now - room.lastActivityAt;
      const isEnded = room.phase === "ENDED";
      const endedExpired = isEnded && room.closedAt && (now - room.closedAt) > config.room.endedGraceMs;
      
      const connectedCount = countConnectedPlayers(room);
      const isEmptyExpired = connectedCount === 0 && idleTime > config.room.emptyTtlMs;
      const isIdleExpired = idleTime > config.room.idleTtlMs;

      let shouldDelete = false;
      let reason = "";

      if (endedExpired) {
        shouldDelete = true;
        reason = "grace period ended";
      } else if (isEmptyExpired) {
        shouldDelete = true;
        reason = "no connected players";
      } else if (isIdleExpired) {
        shouldDelete = true;
        reason = "idle timeout";
      }

      if (shouldDelete) {
        console.log(`Janitor: Deleting room ${room.roomCode}. Reason: ${reason}.`);
        clearRoomTimer(room);
        store.delete(room.roomCode);
      }
    }
  }, intervalMs);
}
