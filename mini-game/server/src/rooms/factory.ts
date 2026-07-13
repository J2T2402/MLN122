import { randomUUID } from "node:crypto";
import { Room, Team } from "../types/domain";
import { TeamId } from "../shared/socket/events";
import { getQuestionsBank, getStationQuestionIds } from "../questions/loader";
import { roomStore } from "./store";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; // readable characters, omit I, 1, O, 0
  let code = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    code += chars[idx];
  }
  return code;
}

// Map of 6 teams as defined in the spec
export const TEAMS_DEFINITION: Record<TeamId, { name: string; color: string }> = {
  1: { name: "Hồng San Hô", color: "#E11D48" },
  2: { name: "Cam Hải Đăng", color: "#F97316" },
  3: { name: "Vàng Cánh Buồm", color: "#FACC15" },
  4: { name: "Lục Rong Biển", color: "#22C55E" },
  5: { name: "Lam Sóng Bạc", color: "#06B6D4" },
  6: { name: "Tím Hải Vương", color: "#A855F7" },
};

export function createRoom(): Room {
  let roomCode = generateRoomCode();
  let attempts = 0;
  
  // Ensure unique code
  while (roomStore.get(roomCode) && attempts < 100) {
    roomCode = generateRoomCode();
    attempts++;
  }

  // Generate host secret
  const hostSecret = randomUUID ? randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);

  // Initialize teams
  const teams = new Map<TeamId, Team>();
  for (const [teamIdStr, def] of Object.entries(TEAMS_DEFINITION)) {
    const teamId = Number(teamIdStr) as TeamId;
    teams.set(teamId, {
      teamId,
      teamName: def.name,
      color: def.color,
      score: 0,
      shipProgress: 0,
      stationReached: 1, // start at station 1
    });
  }

  // Load static questions
  const loadedQuestions = getQuestionsBank();
  const loadedStations = getStationQuestionIds();

  // Create currentQuestionIndexMap
  const currentQuestionIndexMap = new Map();
  currentQuestionIndexMap.set(1, 0);
  currentQuestionIndexMap.set(2, 0);
  currentQuestionIndexMap.set(3, 0);
  currentQuestionIndexMap.set(4, 0);
  currentQuestionIndexMap.set("boss", 0);

  const room: Room = {
    roomCode,
    hostSecret,
    phase: "LOBBY",
    mode: "chuan",
    currentStation: null,
    currentQuestionId: null,
    deadlineTs: null,
    durationSec: 0,
    resumePhase: null,
    players: new Map(),
    teams,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    submissions: new Map(),
    questionsBank: new Map(loadedQuestions),
    stationQuestionIds: new Map(loadedStations),
    currentQuestionIndexMap,
  };

  roomStore.create(room);
  return room;
}
