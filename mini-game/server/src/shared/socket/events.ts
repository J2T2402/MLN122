export type Role = "player" | "screen" | "host";
export type TeamId = 1 | 2 | 3 | 4 | 5 | 6;
export type StationId = 1 | 2 | 3 | 4 | "boss";
export type QuestionType =
  | "mcq" | "selectwrong" | "truefalse" | "dragdrop" | "matching";
export type GamePhase =
  | "LOBBY" | "TEAM_SELECT" | "INTRO"
  | "STATION_OPEN" | "ANSWERING" | "LOCKED" | "REVEAL" | "KNOWLEDGE_CARD"
  | "LEADERBOARD" | "BOSS_INTRO" | "BOSS_ANSWERING" | "BOSS_REVEAL"
  | "VICTORY" | "ENDED" | "PAUSED" | "FALLBACK";
export type GameMode = "lite" | "chuan" | "fallback" | "no-projector";

// Stripped question format sent to player/screen
export interface PublicQuestion {
  questionId: string;
  station: StationId;
  stationName: string;
  type: QuestionType;
  topic: string;
  learningLevel: string;   // e.g., "nho" | "hieu" | "phan_loai" | "van_dung"
  difficulty: 1 | 2 | 3;
  timeLimitSec: number;
  basePoints: number;
  prompt: string;
  pointsMultiplier?: number;             // Only present in Boss (e.g. 2)
  options?: { id: string; text: string }[];        // mcq, selectwrong
  statements?: { id: string; text: string }[];      // truefalse
  buckets?: { id: string; name: string }[];         // dragdrop, matching
  items?: { id: string; text: string }[];           // dragdrop, matching
}

// Answer payload sent by player
export type AnswerPayload =
  | { type: "mcq"; optionId: string }
  | { type: "selectwrong"; optionId: string }
  | { type: "truefalse"; answers: Record<string, boolean> }   // statementId -> boolean
  | { type: "dragdrop"; placement: Record<string, string> }    // itemId -> bucketId
  | { type: "matching"; placement: Record<string, string> };   // itemId -> bucketId

export interface ClientToServer {
  // Player events
  joinRoom: (
    p: { roomCode: string; role: Role; reconnectToken?: string },
    ack: (r: { ok: boolean; playerId?: string; reconnectToken?: string; error?: string }) => void
  ) => void;

  setNickname: (p: { nickname: string; avatar?: string }) => void;

  submitAnswer: (
    p: { questionId: string; answer: AnswerPayload; clientSentAt: number },
    ack: (r: { ok: boolean; received: boolean; error?: string }) => void
  ) => void;

  sendReaction: (p: { emoji: string }) => void;

  rejoin: (
    p: { reconnectToken: string },
    ack: (r: { ok: boolean; error?: string }) => void
  ) => void;

  // Host events
  startGame: (p: { roomCode: string }) => void;
  openStation: (p: { station: StationId }) => void;
  startAnswering: (p: { questionId: string }) => void;
  lockAnswers: (p: { questionId: string }) => void;
  revealAnswer: (p: { questionId: string }) => void;
  showKnowledgeCard: (p: { questionId: string }) => void;
  showLeaderboard: () => void;
  nextStation: () => void;
  startBoss: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  setMode: (p: { mode: GameMode }) => void;
  endGame: () => void;
}

export interface ServerToClient {
  // Room state update
  roomState: (p: {
    roomCode: string;
    phase: GamePhase;
    mode: GameMode;
    currentStation: StationId | null;
    currentQuestionId: string | null;
    serverNow: number;
    resumePhase?: GamePhase;
    hasMoreInStation?: boolean;   // true if current station has another question the host can open
  }) => void;

  playerList: (p: {
    players: {
      playerId: string;
      nickname: string;
      avatar?: string;
      teamId: TeamId | null;
      connected: boolean;
    }[];
    counts: {
      total: number;
      connected: number;
      perTeam: Record<TeamId, number>;
    };
  }) => void;

  teamAssigned: (p: { playerId: string; teamId: TeamId; teamName: string }) => void;

  stationOpened: (p: {
    question: PublicQuestion;
    phase: "STATION_OPEN" | "ANSWERING" | "BOSS_ANSWERING";
  }) => void;

  // HOST-ONLY: correct answer preview for the MC console. Sent only to the host room so
  // students can never read answers from the client bundle (NFR4 "đáp án chỉ ở server").
  hostQuestionInfo: (p: {
    questionId: string;
    type: QuestionType;
    prompt: string;
    answerText: string;   // human-readable correct answer for the MC
    explain: string;
  }) => void;

  timerSync: (p: {
    questionId: string;
    deadlineTs: number;
    serverNow: number;
    durationSec: number;
  }) => void;

  answerLocked: (p: {
    questionId: string;
    answeredCount: number;
    totalPlayers: number;
  }) => void;

  answerRevealed: (p: {
    questionId: string;
    type: QuestionType;
    correct: {
      optionId?: string;
      wrongOptionId?: string;
      statements?: Record<string, boolean>;
      placement?: Record<string, string>;
    };
    stats: {
      optionPct?: Record<string, number>;
      statementCorrectPct?: Record<string, number>;
      bucketCorrectPct?: Record<string, number>;
      classCorrectPct: number;
    };
    yourResult?: {
      isCorrect: boolean;
      pointsEarned: number;
      speedBonus: number;
      streak: number;
    };
  }) => void;

  knowledgeCard: (p: {
    questionId: string;
    explain: string;
    knowledgeCard: {
      title: string;
      body: string;
      badge?: string;
      station: StationId;
    };
  }) => void;

  leaderboardUpdate: (p: {
    players: {
      playerId: string;
      nickname: string;
      teamId: TeamId;
      score: number;
      streak: number;
      rank: number;
    }[];
    teams: {
      teamId: TeamId;
      teamName: string;
      score: number;
      rank: number;
    }[];
    shipPositions: {
      teamId: TeamId;
      progress: number; // 0..1 progress to finish line
      stationReached: StationId;
    }[];
  }) => void;

  bossPhase: (p: {
    phase: "BOSS_INTRO" | "BOSS_ANSWERING" | "BOSS_REVEAL";
    pointsMultiplier: number;
    title: string;
  }) => void;

  modeChanged: (p: {
    mode: GameMode;
    reason?: string;
  }) => void;

  gameEnded: (p: {
    winnerTeam: { teamId: TeamId; teamName: string; score: number };
    topPlayers: { playerId: string; nickname: string; score: number }[];
    finalTeams: { teamId: TeamId; score: number; rank: number }[];
  }) => void;

  answerAck: (p: {
    questionId: string;
    received: boolean;
    serverReceivedAt: number;
  }) => void;

  reactionBroadcast: (p: {
    emoji: string;
    teamId: TeamId | null;
    nickname?: string;
  }) => void;

  errorEvent: (p: {
    code: string;
    message: string;
    fatal: boolean;
  }) => void;
}
