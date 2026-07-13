import "dotenv/config";
import { GameMode } from "../shared/socket/events";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

const num = (name: string, def: number): number => {
  const v = process.env[name];
  return v ? Number(v) : def;
};

export const config = {
  port: num("PORT", 3000),
  hostTokenSecret: required("HOST_TOKEN_SECRET"),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),
  questionsPath: process.env.QUESTIONS_PATH ?? "./data/questions.json",
  maxPlayers: num("MAX_PLAYERS", 30),
  defaultMode: (process.env.DEFAULT_MODE ?? "chuan") as GameMode,

  room: {
    idleTtlMs: num("ROOM_IDLE_TTL_MS", 2 * 60 * 60 * 1000), // 2 hours
    endedGraceMs: num("ROOM_ENDED_GRACE_MS", 5 * 60 * 1000), // 5 minutes
    emptyTtlMs: num("ROOM_EMPTY_TTL_MS", 15 * 60 * 1000), // 15 minutes
    janitorMs: num("JANITOR_INTERVAL_MS", 60 * 1000), // 60s
  },

  timerGraceMs: num("TIMER_GRACE_MS", 500),
  rateLimitSubmitMs: num("RATE_LIMIT_SUBMIT_MS", 250),
  rateLimitReactMs: num("RATE_LIMIT_REACTION_MS", 500),
  logLevel: process.env.LOG_LEVEL ?? "info",
} as const;
