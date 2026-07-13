import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { socket } from "../../shared/socket/client";
import { GamePhase, GameMode, StationId, TeamId, PublicQuestion, AnswerPayload } from "../../shared/socket/events";
import { NetworkBanner, PausedOverlay, ScoreChip, TeamBadge } from "../../shared/components/UI";
import { ReactionLayer } from "../../shared/components/ReactionLayer";

// Import individual sub-screens
import { JoinScreen } from "./screens/JoinScreen";
import { NicknameScreen } from "./screens/NicknameScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { IntroScreen } from "./screens/IntroScreen";
import { ChallengeScreen } from "./screens/ChallengeScreen";
import { KnowledgeCardScreen } from "./screens/KnowledgeCardScreen";
import { ResultScreen } from "./screens/ResultScreen";

export const PlayerRoot: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  // Connection States
  const [connected, setConnected] = useState<boolean>(false);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  
  // Game States
  const [roomCode, setRoomCode] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [reconnectToken, setReconnectToken] = useState<string>("");
  const [phase, setPhase] = useState<GamePhase | "JOIN_SCREEN">("JOIN_SCREEN");
  const [mode, setMode] = useState<GameMode>("chuan");
  const [resumePhase, setResumePhase] = useState<GamePhase | null>(null);
  
  // Player Stats
  const [nickname, setNickname] = useState<string>("");
  const [nicknameSet, setNicknameSet] = useState<boolean>(false);
  const [teamId, setTeamId] = useState<TeamId | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<TeamId, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });

  // Question & Timer States
  const [currentStation, setCurrentStation] = useState<StationId | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [clockOffset, setClockOffset] = useState<number>(0);
  
  // Answer Submission States
  const [answerState, setAnswerState] = useState<"idle" | "selecting" | "submitting" | "submitted" | "locked" | "revealed">("idle");
  const [localAnswer, setLocalAnswer] = useState<any>(null);
  
  // Result States
  const [stats, setStats] = useState<any>(null);
  const [correct, setCorrect] = useState<any>(null);
  const [yourResult, setYourResult] = useState<any>(null);
  
  // Knowledge Card
  const [knowledgeCard, setKnowledgeCard] = useState<any>(null);
  const [explain, setExplain] = useState<string>("");
  
  // Leaderboard / Endgame
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [endgameData, setEndgameData] = useState<any>(null);

  // Read query params and storage on init
  useEffect(() => {
    const code = searchParams.get("room") || "";
    if (code) {
      setRoomCode(code.toUpperCase());
    }

    const storedPlayerId = localStorage.getItem("playerId") || "";
    const storedToken = localStorage.getItem("reconnectToken") || "";
    const storedRoomCode = localStorage.getItem("roomCode") || "";
    
    if (storedPlayerId && storedToken && storedRoomCode === code.toUpperCase()) {
      setPlayerId(storedPlayerId);
      setReconnectToken(storedToken);
    }

    socket.connect();
    
    return () => {
      socket.disconnect();
    };
  }, [searchParams]);

  // Socket event hookups
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);

      // Auto-rejoin if reconnect details exist
      const storedToken = localStorage.getItem("reconnectToken");
      const storedCode = localStorage.getItem("roomCode");
      if (storedToken && storedCode) {
        socket.emit("joinRoom", { roomCode: storedCode, role: "player", reconnectToken: storedToken }, (ack) => {
          if (ack.ok && ack.playerId) {
            setPlayerId(ack.playerId);
            setNicknameSet(true); // reconnecting player already chose a nickname earlier
            localStorage.setItem("playerId", ack.playerId);
            localStorage.setItem("reconnectToken", ack.reconnectToken || "");
            localStorage.setItem("roomCode", storedCode);
          } else {
            // Token expired or invalid, clear storage
            localStorage.removeItem("playerId");
            localStorage.removeItem("reconnectToken");
            localStorage.removeItem("roomCode");
            setPhase("JOIN_SCREEN");
          }
        });
      }
    };

    const onDisconnect = () => {
      setConnected(false);
      setReconnecting(true);
    };

    const onRoomState = (p: any) => {
      setRoomCode(p.roomCode);
      setPhase(p.phase);
      setMode(p.mode);
      setCurrentStation(p.currentStation);
      setCurrentQuestionId(p.currentQuestionId);
      setClockOffset(p.serverNow - Date.now());
      if (p.resumePhase) setResumePhase(p.resumePhase);

      // Save room info to storage
      localStorage.setItem("roomCode", p.roomCode);
    };

    const onPlayerList = (p: any) => {
      setPlayersList(p.players);
      setTeamCounts(p.counts.perTeam);
      
      // Update self connection state and nickname from list
      const selfPlayer = p.players.find((pl: any) => pl.playerId === playerId);
      if (selfPlayer) {
        setNickname(selfPlayer.nickname);
        if (selfPlayer.teamId !== null) {
          setTeamId(selfPlayer.teamId);
        }
      }
    };

    const onTeamAssigned = (p: any) => {
      if (p.playerId === playerId) {
        setTeamId(p.teamId);
        setTeamName(p.teamName);
      }
    };

    const onStationOpened = (p: any) => {
      setQuestion(p.question);
      setLocalAnswer(null);
      setAnswerState("idle");
      setYourResult(null);
      setStats(null);
      setCorrect(null);
    };

    const onTimerSync = (p: any) => {
      setDeadlineTs(p.deadlineTs);
      setDurationSec(p.durationSec);
      setClockOffset(p.serverNow - Date.now());
      if (answerState === "idle" || answerState === "selecting") {
        setAnswerState("selecting");
      }
    };

    const onAnswerAck = (p: any) => {
      if (p.questionId === currentQuestionId && p.received) {
        setAnswerState("submitted");
      }
    };

    const onAnswerLocked = (p: any) => {
      if (p.questionId === currentQuestionId) {
        setAnswerState(prev => prev === "revealed" ? "revealed" : "locked");
      }
    };

    const onAnswerRevealed = (p: any) => {
      if (p.questionId === currentQuestionId) {
        setStats(p.stats);
        setCorrect(p.correct);
        setAnswerState("revealed");
        
        if (p.yourResult) {
          setYourResult(p.yourResult);
          setScore(prev => prev + p.yourResult.pointsEarned);
          setStreak(p.yourResult.streak);
        }
      }
    };

    const onKnowledgeCard = (p: any) => {
      if (p.questionId === currentQuestionId) {
        setKnowledgeCard(p.knowledgeCard);
        setExplain(p.explain);
      }
    };

    const onLeaderboardUpdate = (p: any) => {
      setLeaderboard(p);
      const selfRank = p.players.find((pl: any) => pl.playerId === playerId);
      if (selfRank) {
        setScore(selfRank.score);
        setStreak(selfRank.streak);
      }
    };

    const onModeChanged = (p: any) => {
      setMode(p.mode);
    };

    const onGameEnded = (p: any) => {
      setEndgameData(p);
      localStorage.removeItem("playerId");
      localStorage.removeItem("reconnectToken");
      localStorage.removeItem("roomCode");
    };

    const onErrorEvent = (p: any) => {
      console.error("Socket error event:", p);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("roomState", onRoomState);
    socket.on("playerList", onPlayerList);
    socket.on("teamAssigned", onTeamAssigned);
    socket.on("stationOpened", onStationOpened);
    socket.on("timerSync", onTimerSync);
    socket.on("answerAck", onAnswerAck);
    socket.on("answerLocked", onAnswerLocked);
    socket.on("answerRevealed", onAnswerRevealed);
    socket.on("knowledgeCard", onKnowledgeCard);
    socket.on("leaderboardUpdate", onLeaderboardUpdate);
    socket.on("modeChanged", onModeChanged);
    socket.on("gameEnded", onGameEnded);
    socket.on("errorEvent", onErrorEvent);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("roomState", onRoomState);
      socket.off("playerList", onPlayerList);
      socket.off("teamAssigned", onTeamAssigned);
      socket.off("stationOpened", onStationOpened);
      socket.off("timerSync", onTimerSync);
      socket.off("answerAck", onAnswerAck);
      socket.off("answerLocked", onAnswerLocked);
      socket.off("answerRevealed", onAnswerRevealed);
      socket.off("knowledgeCard", onKnowledgeCard);
      socket.off("leaderboardUpdate", onLeaderboardUpdate);
      socket.off("modeChanged", onModeChanged);
      socket.off("gameEnded", onGameEnded);
      socket.off("errorEvent", onErrorEvent);
    };
  }, [playerId, currentQuestionId, answerState]);

  // Handle successful join
  const handleJoined = (joinedRoomCode: string, joinedPlayerId: string, token: string) => {
    setRoomCode(joinedRoomCode.toUpperCase());
    setPlayerId(joinedPlayerId);
    setReconnectToken(token);
    
    localStorage.setItem("playerId", joinedPlayerId);
    localStorage.setItem("reconnectToken", token);
    localStorage.setItem("roomCode", joinedRoomCode.toUpperCase());
  };

  // Screen router based on roomState.phase
  const renderContent = () => {
    // 1. Join room
    if (phase === "JOIN_SCREEN") {
      return (
        <JoinScreen
          initialRoomCode={roomCode}
          onJoined={handleJoined}
        />
      );
    }

    // 2. Set Nickname
    if (!nicknameSet) {
      return (
        <NicknameScreen
          roomCode={roomCode}
          onNicknameSaved={(nick, av) => {
            setNickname(nick);
            setNicknameSet(true);
            socket.emit("setNickname", { nickname: nick, avatar: av });
          }}
        />
      );
    }

    // 3. Lobby waiting screen
    if (phase === "LOBBY") {
      return (
        <LobbyScreen
          roomCode={roomCode}
          players={playersList}
          playerId={playerId}
          nickname={nickname}
        />
      );
    }

    // 4. Đội được XẾP TỰ ĐỘNG (chia đều) ngay khi vào phòng — chỉ hiển thị đội của mình.
    if (phase === "TEAM_SELECT") {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-5 bg-bg">
          <div className="text-6xl animate-bounce">⛵</div>
          <h2 className="text-2xl font-black font-display text-primary-900">Bạn đã được xếp hạm đội!</h2>
          {teamId !== null ? (
            <TeamBadge teamId={teamId} className="scale-150" />
          ) : (
            <p className="text-neutral-500">Đang xếp đội…</p>
          )}
          <p className="text-sm text-neutral-600 max-w-xs">
            Hệ thống tự động chia đều các hạm đội. Hãy sẵn sàng — chờ MC bắt đầu hải trình!
          </p>
        </div>
      );
    }

    // 5. Intro Screen
    if (phase === "INTRO") {
      return <IntroScreen teamId={teamId} />;
    }

    // 6. Challenge question screen (bao gom ca vong BOSS)
    if ((phase === "STATION_OPEN" || phase === "ANSWERING" || phase === "LOCKED" || phase === "BOSS_ANSWERING") && question) {
      return (
        <ChallengeScreen
          question={question}
          phase={phase}
          deadlineTs={deadlineTs}
          clockOffset={clockOffset}
          durationSec={durationSec}
          answerState={answerState}
          localAnswer={localAnswer}
          setLocalAnswer={setLocalAnswer}
          streak={streak}
          onSubmitAnswer={(ans) => {
            // Chỉ cho nộp khi server thực sự đang mở pha trả lời (tránh NOT_ANSWERING).
            if (phase !== "ANSWERING" && phase !== "BOSS_ANSWERING") return;
            setAnswerState("submitting");
            socket.emit("submitAnswer", {
              questionId: question.questionId,
              answer: ans,
              clientSentAt: Date.now()
            }, (ack) => {
              if (ack.ok && ack.received) {
                setAnswerState("submitted");
              } else {
                setAnswerState("selecting");
                alert(`Lỗi nộp bài: ${ack.error || "Mạng chập chờn"}`);
              }
            });
          }}
        />
      );
    }

    // 7. Reveal & Results
    if (phase === "REVEAL" || phase === "BOSS_REVEAL") {
      return (
        <ResultScreen
          phase={phase}
          question={question}
          correct={correct}
          stats={stats}
          yourResult={yourResult}
          score={score}
          streak={streak}
        />
      );
    }

    // 8. Knowledge Card lật thẻ
    if (phase === "KNOWLEDGE_CARD" && knowledgeCard) {
      return (
        <KnowledgeCardScreen
          card={knowledgeCard}
          explain={explain}
        />
      );
    }

    // 9. Leaderboard
    if (phase === "LEADERBOARD" && leaderboard) {
      return (
        <ResultScreen
          phase={phase}
          leaderboard={leaderboard}
          playerId={playerId}
          teamId={teamId}
          score={score}
          streak={streak}
        />
      );
    }

    // 10. Victory & Ended summary
    if (phase === "VICTORY" || phase === "ENDED") {
      return (
        <ResultScreen
          phase={phase}
          endgameData={endgameData}
          score={score}
          streak={streak}
          playerId={playerId}
        />
      );
    }

    // Boss intro hype (player) — tranh spinner o man gioi thieu Boss
    if (phase === "BOSS_INTRO") {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-boss text-white">
          <div className="text-6xl mb-4 animate-bounce">🌊</div>
          <h2 className="text-3xl font-extrabold font-display text-accent-300 mb-3">CƠN BÃO NHÀ Ở XÃ HỘI</h2>
          <p className="text-lg text-white/90 mb-2">Trận BOSS sắp bắt đầu — điểm nhân đôi (×2)!</p>
          <p className="text-sm text-white/70">Sẵn sàng vận dụng kiến thức để vượt bão…</p>
        </div>
      );
    }

    // Fallback loading screen
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-primary-900 text-white">
        <svg className="animate-spin h-8 w-8 text-accent-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg">Đang đồng bộ với phòng học...</p>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full bg-bg shadow-lg min-h-screen relative overflow-x-hidden">
      {/* Network banner */}
      <NetworkBanner show={reconnecting} />

      {/* Top Status Bar (Sticky only after player joins and has nickname/team) */}
      {phase !== "JOIN_SCREEN" && nickname && (
        <header className="sticky top-0 bg-white/95 backdrop-blur-sm py-3 px-4 border-b border-neutral-300 flex items-center justify-between z-30 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono font-extrabold text-primary-600 bg-primary-100 px-2 py-0.5 rounded text-sm tracking-wide">
              ⚓ {roomCode}
            </span>
            {teamId !== null && (
              <TeamBadge teamId={teamId} className="scale-90" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate max-w-[100px] text-neutral-900">
              {nickname}
            </span>
            <ScoreChip score={score} />
          </div>
        </header>
      )}

      {/* Main Screen Body */}
      <main className="flex-1 flex flex-col">
        {renderContent()}
      </main>

      {/* Emoji float layer (hiển thị cảm xúc bay lên; thanh nút reaction ở đáy đã gỡ bỏ) */}
      <ReactionLayer />

      {/* Pause Game overlay */}
      <PausedOverlay show={phase === "PAUSED"} />
    </div>
  );
};

export default PlayerRoot;
