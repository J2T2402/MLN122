import { Room, Player, Team } from "../types/domain";
import { TeamId, StationId } from "../shared/socket/events";

const TOTAL_LEGS = 5;
const INTRA_LEG = 0.6;
const LEADERBOARD_PLAYER_CAP = 20;

export interface PlayerRankEntry {
  playerId: string;
  nickname: string;
  teamId: TeamId;
  score: number;
  streak: number;
  rank: number;
}

export interface TeamRankEntry {
  teamId: TeamId;
  teamName: string;
  score: number;
  rank: number;
}

export interface ShipPositionEntry {
  teamId: TeamId;
  progress: number;
  stationReached: StationId;
}

export interface LeaderboardUpdate {
  players: PlayerRankEntry[];
  teams: TeamRankEntry[];
  shipPositions: ShipPositionEntry[];
}

export function getStationsCleared(room: Room): number {
  if (room.phase === "VICTORY" || room.phase === "ENDED") {
    return 5;
  }
  
  const currentStation = room.currentStation;
  if (currentStation === null) return 0;
  if (currentStation === 1) return 0;
  if (currentStation === 2) return 1;
  if (currentStation === 3) return 2;
  if (currentStation === 4) return 3;
  if (currentStation === "boss") return 4;
  
  return 0;
}

export function getStationReached(stationsCleared: number): StationId {
  if (stationsCleared === 0) return 1;
  if (stationsCleared === 1) return 2;
  if (stationsCleared === 2) return 3;
  if (stationsCleared === 3) return 4;
  return "boss"; // 4 or 5
}

export function calculateShipProgress(
  teamScore: number,
  maxTeamScore: number,
  stationsCleared: number
): number {
  if (stationsCleared === 5) {
    return 1.0;
  }
  
  const scoreLead = maxTeamScore > 0 ? teamScore / maxTeamScore : 0;
  const progress = (stationsCleared / TOTAL_LEGS) + ((scoreLead * INTRA_LEG) / TOTAL_LEGS);
  return Math.min(1.0, Math.max(0.0, progress));
}

export function getLeaderboard(room: Room): LeaderboardUpdate {
  // 1) Score and rank players
  const playerList = Array.from(room.players.values()).filter(p => p.teamId !== null);
  
  // Sort players: score DESC, streak DESC, joinedAt ASC
  playerList.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.streak !== a.streak) {
      return b.streak - a.streak;
    }
    return a.joinedAt - b.joinedAt;
  });

  // Assign player ranks (standard competition ranking: 1, 2, 2, 4)
  const rankedPlayers: PlayerRankEntry[] = [];
  let currentRank = 1;
  for (let i = 0; i < playerList.length; i++) {
    const p = playerList[i];
    if (i > 0) {
      const prev = playerList[i - 1];
      if (p.score !== prev.score || p.streak !== prev.streak) {
        currentRank = i + 1;
      }
    }
    rankedPlayers.push({
      playerId: p.playerId,
      nickname: p.nickname,
      teamId: p.teamId!,
      score: p.score,
      streak: p.streak,
      rank: currentRank,
    });
  }

  // 2) Score and rank teams
  // Recalculate team scores from member scores
  const teamScores: Record<TeamId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const player of room.players.values()) {
    if (player.teamId !== null) {
      teamScores[player.teamId] += player.score;
    }
  }

  // Update team scores in room state
  for (const [teamId, score] of Object.entries(teamScores)) {
    const tId = Number(teamId) as TeamId;
    const team = room.teams.get(tId);
    if (team) {
      team.score = score;
    }
  }

  const teamList = Array.from(room.teams.values());
  // Sort teams: score DESC, teamId ASC
  teamList.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.teamId - b.teamId;
  });

  // Assign team ranks
  const rankedTeams: TeamRankEntry[] = [];
  let currentTeamRank = 1;
  let maxTeamScore = 0;
  for (let i = 0; i < teamList.length; i++) {
    const t = teamList[i];
    if (i > 0) {
      const prev = teamList[i - 1];
      if (t.score !== prev.score) {
        currentTeamRank = i + 1;
      }
    }
    if (i === 0) {
      maxTeamScore = t.score;
    }
    rankedTeams.push({
      teamId: t.teamId,
      teamName: t.teamName,
      score: t.score,
      rank: currentTeamRank,
    });
  }

  // 3) Calculate ship positions
  const stationsCleared = getStationsCleared(room);
  const stationReached = getStationReached(stationsCleared);

  const shipPositions: ShipPositionEntry[] = Array.from(room.teams.values()).map(t => {
    const progress = calculateShipProgress(t.score, maxTeamScore, stationsCleared);
    
    // Update progress and station in room state
    t.shipProgress = progress;
    t.stationReached = stationReached;

    return {
      teamId: t.teamId,
      progress,
      stationReached,
    };
  });

  return {
    players: rankedPlayers.slice(0, LEADERBOARD_PLAYER_CAP),
    teams: rankedTeams,
    shipPositions,
  };
}
