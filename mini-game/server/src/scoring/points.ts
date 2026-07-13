import { QuestionFull } from "../types/question";
import { GradeResult } from "./grade";

const SPEED_WEIGHT = 0.5;
const COMBO_STEP = 0.1;
const COMBO_CAP = 0.5;

export interface ScoreCalculationResult {
  pointsEarned: number;
  speedBonus: number;
  newStreak: number;
}

export function calculatePoints(
  q: QuestionFull,
  gradeResult: GradeResult,
  streakBefore: number,
  responseMs: number, // time remaining in ms (deadlineTs - serverReceivedAt)
  durationSec: number
): ScoreCalculationResult {
  const basePoints = q.basePoints;
  const correctRatio = gradeResult.correctRatio;
  const isCorrect = gradeResult.isCorrect;

  // 1) Content base points (prorated for partial correctness)
  const contentBase = basePoints * correctRatio;

  // 2) Speed bonus base
  const durationMs = durationSec * 1000;
  const remainingMs = Math.max(0, Math.min(responseMs, durationMs));
  const speedFactor = durationMs > 0 ? remainingMs / durationMs : 0;
  const speedBase = basePoints * SPEED_WEIGHT * speedFactor * correctRatio;

  // 3) Streak combo multiplier
  // Streak is only incremented if correct ratio is 1.0 (fully correct)
  const newStreak = isCorrect ? streakBefore + 1 : 0;
  const comboMult = isCorrect ? 1 + Math.min(newStreak * COMBO_STEP, COMBO_CAP) : 1;

  // 4) Boss multiplier (pointsMultiplier in Boss is 2)
  const pointsMultiplier = q.pointsMultiplier ?? 1;

  // 5) Total points
  const pointsEarned = Math.round((contentBase + speedBase) * comboMult * pointsMultiplier);
  const speedBonus = Math.round(speedBase * comboMult * pointsMultiplier);

  return {
    pointsEarned,
    speedBonus,
    newStreak,
  };
}
