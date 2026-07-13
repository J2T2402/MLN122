import fs from "fs";
import path from "path";
import { config } from "../config/env";
import { QuestionFull } from "../types/question";
import { StationId } from "../shared/socket/events";

let questionsBank: Map<string, QuestionFull> = new Map();
let stationQuestionIds: Map<StationId, string[]> = new Map();

// Helper to map station number in JSON to StationId in code/events
export function mapStationId(stationNum: number): StationId {
  if (stationNum === 6) return "boss";
  if (stationNum >= 1 && stationNum <= 4) {
    return stationNum as StationId;
  }
  throw new Error(`Invalid station number in questions file: ${stationNum}`);
}

export function loadQuestions(): void {
  try {
    const filePath = path.resolve(config.questionsPath);
    console.log(`Loading questions from: ${filePath}`);
    const rawData = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(rawData);

    if (!parsed || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid questions.json format. Expected 'questions' array.");
    }

    const questions: QuestionFull[] = parsed.questions;

    // Reset maps
    questionsBank.clear();
    stationQuestionIds.clear();

    // Initialize arrays for each station
    stationQuestionIds.set(1, []);
    stationQuestionIds.set(2, []);
    stationQuestionIds.set(3, []);
    stationQuestionIds.set(4, []);
    stationQuestionIds.set("boss", []);

    for (const q of questions) {
      if (!q.id) {
        throw new Error(`Question is missing 'id': ${JSON.stringify(q)}`);
      }
      
      const mappedStation = mapStationId(q.station);
      questionsBank.set(q.id, q);
      stationQuestionIds.get(mappedStation)!.push(q.id);
    }

    console.log(`Successfully loaded ${questionsBank.size} questions from questions.json:`);
    for (const [station, ids] of stationQuestionIds.entries()) {
      console.log(`  Station ${station}: ${ids.length} questions`);
    }

    // Verify questions count (7/6/9/7/11 allocation as specified in be-spec.md)
    const expectedCounts: Record<StationId, number> = {
      1: 7,
      2: 6,
      3: 9,
      4: 7,
      "boss": 11,
    };

    for (const [stationStr, expected] of Object.entries(expectedCounts)) {
      const isNumeric = !isNaN(Number(stationStr));
      const station = isNumeric ? Number(stationStr) as StationId : stationStr as StationId;
      const actual = stationQuestionIds.get(station)?.length ?? 0;
      if (actual !== expected) {
        console.warn(
          `WARNING: Expected ${expected} questions for Station ${stationStr}, but found ${actual}.`
        );
      }
    }
  } catch (err) {
    console.error("Failed to load questions:", err);
    throw err;
  }
}

export function getQuestionsBank(): Map<string, QuestionFull> {
  if (questionsBank.size === 0) {
    loadQuestions();
  }
  return questionsBank;
}

export function getStationQuestionIds(): Map<StationId, string[]> {
  if (stationQuestionIds.size === 0) {
    loadQuestions();
  }
  return stationQuestionIds;
}
