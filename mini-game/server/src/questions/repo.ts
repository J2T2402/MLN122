import { QuestionFull } from "../types/question";
import { PublicQuestion, StationId } from "../shared/socket/events";
import { getQuestionsBank, getStationQuestionIds } from "./loader";
import { toPublicQuestion } from "./mapper";

export function getQuestionFull(id: string): QuestionFull | undefined {
  const bank = getQuestionsBank();
  return bank.get(id);
}

export function getQuestionPublic(id: string): PublicQuestion | undefined {
  const q = getQuestionFull(id);
  return q ? toPublicQuestion(q) : undefined;
}

export function getStationQuestionList(station: StationId): string[] {
  const stationMap = getStationQuestionIds();
  return stationMap.get(station) || [];
}
