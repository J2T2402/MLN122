import { Room } from "../types/domain";
import { clearRoomTimer } from "../rooms/janitor";
import { applyTransition } from "./engine";

export function armTimer(
  room: Room,
  questionId: string,
  durationSec: number,
  onTimeoutCallback: (room: Room, qId: string) => void
): void {
  // Clear any existing timer
  clearRoomTimer(room);

  const durationMs = durationSec * 1000;
  room.durationSec = durationSec;
  room.deadlineTs = Date.now() + durationMs;

  room.timerHandle = setTimeout(() => {
    onTimeoutCallback(room, questionId);
  }, durationMs);
}

export function pauseTimer(room: Room): void {
  if (room.timerHandle && room.deadlineTs !== null) {
    clearTimeout(room.timerHandle);
    room.timerHandle = undefined;
    
    // Save remaining time
    const remainingMs = Math.max(0, room.deadlineTs - Date.now());
    room.deadlineTs = remainingMs; // store remaining ms in deadlineTs temporarily during pause
  }
}

export function resumeTimer(
  room: Room,
  questionId: string,
  onTimeoutCallback: (room: Room, qId: string) => void
): number | null {
  if (room.deadlineTs !== null && !room.timerHandle) {
    const remainingMs = room.deadlineTs; // this holds remaining ms
    room.deadlineTs = Date.now() + remainingMs;

    room.timerHandle = setTimeout(() => {
      onTimeoutCallback(room, questionId);
    }, remainingMs);

    return remainingMs;
  }
  return null;
}
