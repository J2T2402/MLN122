import { Room } from "../types/domain";
import { QuestionFull } from "../types/question";
import { StationId } from "../shared/socket/events";
import { getQuestionFull } from "../questions/repo";

export function getCurrentQuestion(room: Room): QuestionFull | undefined {
  if (room.currentStation === null || room.currentQuestionId === null) {
    return undefined;
  }
  return getQuestionFull(room.currentQuestionId);
}

export function hasMoreQuestionsInStation(room: Room, station: StationId): boolean {
  const ids = room.stationQuestionIds.get(station) || [];
  const idx = room.currentQuestionIndexMap.get(station) ?? 0;
  return idx < ids.length - 1;
}

export function getNextQuestionId(room: Room, station: StationId): string | null {
  const ids = room.stationQuestionIds.get(station) || [];
  const idx = room.currentQuestionIndexMap.get(station) ?? 0;
  if (idx < ids.length) {
    return ids[idx];
  }
  return null;
}

export function advanceQuestionInStation(room: Room, station: StationId): boolean {
  const ids = room.stationQuestionIds.get(station) || [];
  const idx = room.currentQuestionIndexMap.get(station) ?? 0;
  
  if (idx < ids.length - 1) {
    room.currentQuestionIndexMap.set(station, idx + 1);
    room.currentQuestionId = ids[idx + 1];
    return true;
  }
  
  return false;
}

export function initializeStation(room: Room, station: StationId): void {
  room.currentStation = station;
  const ids = room.stationQuestionIds.get(station) || [];
  room.currentQuestionIndexMap.set(station, 0);
  if (ids.length > 0) {
    room.currentQuestionId = ids[0];
  } else {
    room.currentQuestionId = null;
  }
}
