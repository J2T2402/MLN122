import { GamePhase } from "../shared/socket/events";

// Define allowed transitions: currentPhase -> action -> nextPhase
const TRANSITIONS: Record<GamePhase, Record<string, GamePhase>> = {
  LOBBY: {
    startGame: "TEAM_SELECT",
  },
  TEAM_SELECT: {
    next: "INTRO",
    openStation: "STATION_OPEN",
    endGame: "VICTORY",
  },
  INTRO: {
    next: "STATION_OPEN",
    openStation: "STATION_OPEN",
    endGame: "VICTORY",
  },
  STATION_OPEN: {
    startAnswering: "ANSWERING",
    endGame: "VICTORY",
  },
  ANSWERING: {
    lockAnswers: "LOCKED",
    endGame: "VICTORY",
  },
  LOCKED: {
    revealAnswer: "REVEAL",
    endGame: "VICTORY",
  },
  REVEAL: {
    showKnowledgeCard: "KNOWLEDGE_CARD",
    showLeaderboard: "LEADERBOARD",
    openStation: "STATION_OPEN", // if more questions in same station
    endGame: "VICTORY",
  },
  KNOWLEDGE_CARD: {
    showLeaderboard: "LEADERBOARD",
    openStation: "STATION_OPEN", // if more questions in same station
    endGame: "VICTORY",
  },
  LEADERBOARD: {
    nextStation: "STATION_OPEN",
    startBoss: "BOSS_INTRO",
    endGame: "VICTORY",
  },
  BOSS_INTRO: {
    startAnswering: "BOSS_ANSWERING",
    endGame: "VICTORY",
  },
  BOSS_ANSWERING: {
    lockAnswers: "LOCKED", // We map lock to LOCKED phase internally, or handle boss lock
    revealAnswer: "BOSS_REVEAL",
    endGame: "VICTORY",
  },
  BOSS_REVEAL: {
    showLeaderboard: "LEADERBOARD",
    startAnswering: "BOSS_ANSWERING", // next boss question
    endGame: "VICTORY",
  },
  VICTORY: {
    endGame: "ENDED",
  },
  ENDED: {},
  PAUSED: {
    resumeGame: "LOBBY", // This will be dynamic, read from room.resumePhase
  },
  FALLBACK: {
    setMode: "LOBBY", // This will be dynamic, read from room.resumePhase
  },
};

export function getNextPhase(current: GamePhase, action: string): GamePhase | null {
  // Global actions like endGame and pauseGame can happen almost anywhere
  if (action === "pauseGame" && current !== "PAUSED") {
    return "PAUSED";
  }
  if (action === "endGame" && current !== "ENDED") {
    return "VICTORY";
  }

  const routes = TRANSITIONS[current];
  if (!routes) return null;

  const next = routes[action];
  return next || null;
}

export function isValidTransition(current: GamePhase, action: string): boolean {
  if (action === "pauseGame" && current !== "PAUSED") return true;
  if (action === "resumeGame" && current === "PAUSED") return true;
  if (action === "endGame" && current !== "ENDED" && current !== "VICTORY") return true;
  
  const next = getNextPhase(current, action);
  return next !== null;
}
