import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { socket } from "../../shared/socket/client";
import { GamePhase, GameMode, StationId, PublicQuestion } from "../../shared/socket/events";
import { ReactionLayer } from "../../shared/components/ReactionLayer";

// Import projector sub-scenes
import { LobbyScene } from "./screens/LobbyScene";
import { IntroScene } from "./screens/IntroScene";
import { ChallengeScene } from "./screens/ChallengeScene";
import { RevealScene } from "./screens/RevealScene";
import { KnowledgeCardScene } from "./screens/KnowledgeCardScene";
import { LeaderboardScene } from "./screens/LeaderboardScene";
import { BossScene } from "./screens/BossScene";
import { VictoryScene } from "./screens/VictoryScene";

export const ScreenRoot: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Socket Connection States
  const [connected, setConnected] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>("");
  const [phase, setPhase] = useState<GamePhase>("LOBBY");
  const [mode, setMode] = useState<GameMode>("chuan");

  // Roster States
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [totalPlayersCount, setTotalPlayersCount] = useState<number>(0);
  const [connectedPlayersCount, setConnectedPlayersCount] = useState<number>(0);

  // Question & Timer States
  const [currentStation, setCurrentStation] = useState<StationId | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [clockOffset, setClockOffset] = useState<number>(0);

  // Result & stats States
  const [stats, setStats] = useState<any>(null);
  const [correct, setCorrect] = useState<any>(null);
  const [answeredCount, setAnsweredCount] = useState<number>(0);

  // Knowledge Card & Leaderboard
  const [knowledgeCard, setKnowledgeCard] = useState<any>(null);
  const [explain, setExplain] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [endgameData, setEndgameData] = useState<any>(null);
  const [bossMultiplier, setBossMultiplier] = useState<number>(2);

  // Set dark theme on mount and clean up on unmount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    
    const code = searchParams.get("room") || "";
    if (code) {
      setRoomCode(code.toUpperCase());
    }

    socket.connect();
    
    return () => {
      document.documentElement.removeAttribute("data-theme");
      socket.disconnect();
    };
  }, [searchParams]);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      const code = searchParams.get("room") || "";
      if (code) {
        socket.emit("joinRoom", { roomCode: code.toUpperCase(), role: "screen" }, (ack) => {
          if (!ack.ok) {
            console.error("Screen failed to join room:", ack.error);
          }
        });
      }
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onRoomState = (p: any) => {
      setRoomCode(p.roomCode);
      setPhase(p.phase);
      setMode(p.mode);
      setCurrentStation(p.currentStation);
      setCurrentQuestionId(p.currentQuestionId);
      setClockOffset(p.serverNow - Date.now());
    };

    const onPlayerList = (p: any) => {
      setPlayersList(p.players);
      setTotalPlayersCount(p.counts.total);
      setConnectedPlayersCount(p.counts.connected);
    };

    const onStationOpened = (p: any) => {
      setQuestion(p.question);
      setStats(null);
      setCorrect(null);
      setAnsweredCount(0);
    };

    const onTimerSync = (p: any) => {
      setDeadlineTs(p.deadlineTs);
      setDurationSec(p.durationSec);
      setClockOffset(p.serverNow - Date.now());
    };

    const onAnswerLocked = (p: any) => {
      setAnsweredCount(p.answeredCount);
    };

    const onAnswerRevealed = (p: any) => {
      if (p.questionId === currentQuestionId) {
        setStats(p.stats);
        setCorrect(p.correct);
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
    };

    const onBossPhase = (p: any) => {
      setBossMultiplier(p.pointsMultiplier);
      if (p.phase === "BOSS_INTRO") {
        setPhase("BOSS_INTRO");
      }
    };

    const onModeChanged = (p: any) => {
      setMode(p.mode);
    };

    const onGameEnded = (p: any) => {
      setEndgameData(p);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("roomState", onRoomState);
    socket.on("playerList", onPlayerList);
    socket.on("stationOpened", onStationOpened);
    socket.on("timerSync", onTimerSync);
    socket.on("answerLocked", onAnswerLocked);
    socket.on("answerRevealed", onAnswerRevealed);
    socket.on("knowledgeCard", onKnowledgeCard);
    socket.on("leaderboardUpdate", onLeaderboardUpdate);
    socket.on("bossPhase", onBossPhase);
    socket.on("modeChanged", onModeChanged);
    socket.on("gameEnded", onGameEnded);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("roomState", onRoomState);
      socket.off("playerList", onPlayerList);
      socket.off("stationOpened", onStationOpened);
      socket.off("timerSync", onTimerSync);
      socket.off("answerLocked", onAnswerLocked);
      socket.off("answerRevealed", onAnswerRevealed);
      socket.off("knowledgeCard", onKnowledgeCard);
      socket.off("leaderboardUpdate", onLeaderboardUpdate);
      socket.off("bossPhase", onBossPhase);
      socket.off("modeChanged", onModeChanged);
      socket.off("gameEnded", onGameEnded);
    };
  }, [currentQuestionId]);

  // Projector Scene router
  const renderScene = () => {
    switch (phase) {
      case "LOBBY":
        return (
          <LobbyScene
            roomCode={roomCode}
            players={playersList}
            connectedCount={connectedPlayersCount}
          />
        );

      case "TEAM_SELECT":
      case "INTRO":
        return <IntroScene />;

      case "STATION_OPEN":
      case "ANSWERING":
      case "LOCKED":
      case "BOSS_ANSWERING":
        return (
          <ChallengeScene
            phase={phase}
            question={question}
            deadlineTs={deadlineTs}
            clockOffset={clockOffset}
            durationSec={durationSec}
            players={playersList}
            answeredCount={answeredCount}
          />
        );

      case "REVEAL":
      case "BOSS_REVEAL":
        return (
          <RevealScene
            phase={phase}
            question={question}
            correct={correct}
            stats={stats}
          />
        );

      case "KNOWLEDGE_CARD":
        return (
          <KnowledgeCardScene
            card={knowledgeCard}
            explain={explain}
          />
        );

      case "LEADERBOARD":
        return (
          <LeaderboardScene
            leaderboard={leaderboard}
          />
        );

      case "BOSS_INTRO":
        return (
          <BossScene multiplier={bossMultiplier} />
        );

      case "VICTORY":
      case "ENDED":
        return (
          <VictoryScene
            endgameData={endgameData}
          />
        );

      case "PAUSED":
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-primary-950/80 backdrop-blur-sm z-50">
            <h2 className="text-6xl font-extrabold font-display text-accent-500 mb-6 tracking-wide animate-pulse">
              ⏸ TẠM DỪNG HẢI TRÌNH
            </h2>
            <p className="text-3xl text-primary-100 font-semibold max-w-2xl leading-normal">
              MC đã tạm dừng trò chơi để bổ sung kiến thức. Hãy chú ý lắng nghe!
            </p>
          </div>
        );

      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <svg className="animate-spin h-16 w-16 text-accent-500 mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-3xl text-primary-200">Đang tải chặng chặng của hạm đội...</p>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg text-text min-h-screen relative overflow-hidden select-none">
      {/* Top indicator bar */}
      <header className="bg-primary-950/80 border-b border-primary-800 py-3.5 px-8 flex items-center justify-between z-30 select-none">
        <span className="text-2xl font-black font-display text-white tracking-wider">
          🧭 HÀNH TRÌNH ĐỊNH HƯỚNG — 5 TRẠM TRI THỨC
        </span>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-primary-900 border border-primary-700 px-4 py-1.5 rounded-lg shadow-sm">
            <span className="text-sm font-semibold text-primary-300 uppercase tracking-widest font-mono">MÃ PHÒNG</span>
            <span className="text-3xl font-black text-accent-500 font-mono tracking-wider">
              {roomCode || "----"}
            </span>
          </div>
          <span className={`h-3.5 w-3.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-danger"}`}></span>
        </div>
      </header>

      {/* Main presentational scene */}
      <main className="flex-1 flex flex-col relative z-20">
        {renderScene()}
      </main>

      {/* Floating real-time reactions layer */}
      <ReactionLayer />
    </div>
  );
};

export default ScreenRoot;
