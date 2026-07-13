import { GamePhase, GameMode, StationId, TeamId, AnswerPayload } from "../shared/socket/events";
import { QuestionFull } from "./question";

export interface Submission {
  playerId: string;
  questionId: string;
  answer: AnswerPayload;
  isCorrect: boolean;
  correctRatio: number; // 0..1 ratio of correct items (for matching/truefalse/dragdrop)
  responseMs: number; // time took to respond (relative to countdown start)
  pointsEarned: number;
  serverReceivedAt: number;
  clientSentAt: number;
}

export interface Player {
  playerId: string;
  socketId: string | null;
  nickname: string;
  avatar?: string;
  teamId: TeamId | null;
  reconnectToken: string;
  score: number;
  streak: number;
  connected: boolean;
  submissionsByQuestion: Map<string, Submission>; // questionId -> Submission
  joinedAt: number;
}

export interface Team {
  teamId: TeamId;
  teamName: string;
  color: string;
  score: number;
  shipProgress: number; // 0..1 progress to Cảng Đích
  stationReached: StationId;
}

export interface Room {
  roomCode: string;
  hostSecret: string; // token verification secret
  phase: GamePhase;
  mode: GameMode;
  currentStation: StationId | null;
  currentQuestionId: string | null;
  deadlineTs: number | null;
  durationSec: number;
  resumePhase: GamePhase | null;
  players: Map<string, Player>; // playerId -> Player
  teams: Map<TeamId, Team>; // teamId -> Team
  createdAt: number;
  lastActivityAt: number;
  closedAt?: number;
  timerHandle?: NodeJS.Timeout;
  
  // Submissions mapping: questionId -> playerId -> Submission
  submissions: Map<string, Map<string, Submission>>;

  // Questions queue mapping
  questionsBank: Map<string, QuestionFull>;
  stationQuestionIds: Map<StationId, string[]>; // stationId -> array of questionIds
  currentQuestionIndexMap: Map<StationId, number>; // stationId -> index of current question in queue
}
