import React, { useEffect, useState } from "react";
import { Trophy, Award, Star, Compass, BookOpen, Ship } from "lucide-react";
import { TeamBadge } from "../../../shared/components/UI";
import { TeamId } from "../../../shared/socket/events";
import confetti from "canvas-confetti";

interface VictorySceneProps {
  endgameData: any;
}

export const VictoryScene: React.FC<VictorySceneProps> = ({ endgameData }) => {
  const [showGallery, setShowGallery] = useState<boolean>(false);

  useEffect(() => {
    // Fire confetti when victory mounts
    if (endgameData && !showGallery) {
      const winner = endgameData.winnerTeam || { teamId: 1 };
      
      const teamColors: Record<number, string> = {
        1: "#E11D48",
        2: "#F97316",
        3: "#FACC15",
        4: "#22C55E",
        5: "#06B6D4",
        6: "#A855F7",
      };
      
      const color = teamColors[winner.teamId] || "#FFB800";

      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        // Confetti from two sides
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: [color, "#FFB800", "#FFFFFF"] });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: [color, "#FFB800", "#FFFFFF"] });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [endgameData, showGallery]);

  if (!endgameData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-primary-200">
        <svg className="animate-spin h-12 w-12 text-accent-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-2xl">Đang tải tổng kết chung cuộc...</p>
      </div>
    );
  }

  const winTeam = endgameData.winnerTeam || { teamId: 1, teamName: "Hồng San Hô", score: 0 };
  const sortedTeams = [...(endgameData.finalTeams || [])].sort((a, b) => a.rank - b.rank);
  const mvpPlayer = endgameData.topPlayers?.[0] || { nickname: "Thủy Thủ", score: 0 };

  // 5 static cards from program for MÀN 10
  const summaryCards = [
    { id: 1, name: "Trạm 1", title: "Đảo Khái Niệm", body: "KTTT định hướng XHCN = vận hành theo quy luật thị trường + định hướng XHCN do Đảng lãnh đạo.", color: "border-team-1" },
    { id: 2, name: "Trạm 2", title: "Eo Biển Tất Yếu", body: "Tất yếu do: (1) thành tựu văn minh; (2) phân bổ hiệu quả; (3) đa sở hữu, đa thành phần ở VN.", color: "border-team-2" },
    { id: 3, name: "Trạm 3", title: "Quần Đảo Đặc Trưng", body: "4 đặc trưng cơ bản theo trục: Mục tiêu - Sở hữu/Thành phần - Quản lý - Phân phối.", color: "border-team-3" },
    { id: 4, name: "Trạm 4", title: "Cảng Thể Chế", body: "Hoàn thiện thể chế bằng cách hoàn thiện sở hữu, phát triển thị trường, và nâng cao vai trò Nhà nước.", color: "border-team-4" },
    { id: 5, name: "Trạm 5", title: "Boss: Bão NOXH", body: "Nhà nước điều tiết NOXH bằng 3 công cụ: Đất đai (giao đất sạch) · Thuế (giảm 50%) · Lãi suất (vay ưu đãi 4.8%).", color: "border-boss" },
  ];

  if (showGallery) {
    return (
      <div className="flex-1 flex flex-col p-10 justify-between select-none relative animate-fade-in">
        <div className="flex justify-between items-center border-b border-primary-800 pb-4 mb-6">
          <h2 className="text-4xl font-black font-display text-accent-500 flex items-center gap-2">
            <BookOpen size={36} />
            BỘ SƯU TẬP 5 THẺ TRI THỨC — HÀNH TRANG VỀ CẢNG
          </h2>
          <button
            onClick={() => setShowGallery(false)}
            className="bg-primary-800 hover:bg-primary-750 text-white font-semibold font-display px-4 py-2 rounded-xl text-base border border-primary-700 transition-all select-none active:scale-97"
          >
            ← BẢNG DANH DỰ
          </button>
        </div>

        {/* 5 Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 my-auto">
          {summaryCards.map((card) => (
            <div
              key={card.id}
              className={`bg-white text-neutral-900 rounded-xl border-t-8 ${card.color} shadow-lg p-5 flex flex-col gap-3 h-[320px] transition-transform transform hover:scale-102`}
            >
              <span className="text-xs font-bold text-neutral-400 font-mono tracking-wider uppercase">
                {card.name}
              </span>
              <h3 className="text-xl font-bold font-display text-primary-950 border-b pb-1.5 leading-snug">
                {card.title}
              </h3>
              <p className="text-sm font-semibold text-neutral-700 leading-relaxed overflow-y-auto pr-1">
                {card.body}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center text-primary-300 font-bold text-lg mt-6">
          ✦ Đã sưu tầm đủ 5/5 Thẻ Tri Thức chặng đấu — Chúc hạm đội cập cảng thành công! ✦
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-8 p-6 lg:p-10 select-none relative overflow-hidden items-center justify-between animate-fade-in">
      
      {/* Left Panel: Giant Podium winners */}
      <div className="flex-[5] flex flex-col gap-6 justify-center">
        <div className="flex items-center gap-2">
          <Trophy size={36} className="text-accent-500 animate-float" />
          <h2 className="text-4xl font-black font-display text-white tracking-wide">
            BẢNG DANH DỰ HẠM ĐỘI
          </h2>
        </div>

        {/* Podium Card */}
        <div className="bg-primary-900/40 rounded-2xl border border-primary-800 p-8 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-sm min-h-[380px]">
          <span className="text-sm font-bold text-accent-300 font-mono tracking-widest uppercase mb-1">
            🥇 HẠM ĐỘI VÔ ĐỊCH 🥇
          </span>
          <h1 className="text-7xl font-black font-display text-white mt-1 border-b border-primary-800 pb-3 mb-3 w-full select-text">
            {winTeam.teamName}
          </h1>
          <div className="font-mono text-5xl font-black text-accent-500 animate-pulse">
            ⚡ {winTeam.score}đ
          </div>

          {/* Runners up list */}
          <div className="flex justify-center gap-8 mt-10 w-full border-t border-primary-850 pt-6">
            {sortedTeams.slice(1, 3).map((team: any, idx: number) => (
              <div key={team.teamId} className="flex flex-col items-center gap-1">
                <span className="text-sm font-bold text-primary-300 font-mono">
                  {idx === 0 ? "🥈 Á QUÂN" : "🥉 HẠNG BA"}
                </span>
                <TeamBadge teamId={team.teamId} className="scale-90" />
                <span className="font-mono text-base font-bold text-neutral-200 mt-1">
                  ⚡ {team.score}đ
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: MVP & Navigation */}
      <div className="flex-[3] bg-primary-900/40 rounded-2xl border border-primary-800 p-8 flex flex-col h-[500px] shadow-2xl backdrop-blur-sm justify-between">
        
        {/* MVP display */}
        <div className="flex flex-col gap-6 items-center text-center my-auto justify-center">
          <div className="bg-yellow-500/10 text-yellow-500 p-4 rounded-full border border-yellow-500 shadow-lg animate-float">
            <Star size={44} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-accent-500 font-mono tracking-widest uppercase mb-1">
              👑 THỦY THỦ MVP CHUNG CUỘC 👑
            </span>
            <span className="text-3xl font-black font-display text-white mt-1 select-text">
              {mvpPlayer.nickname}
            </span>
            {mvpPlayer.teamId && (
              <TeamBadge teamId={mvpPlayer.teamId} className="scale-90 mt-2 mx-auto" />
            )}
            <span className="font-mono text-2xl font-black text-accent-500 mt-4 block">
              ⚡ {mvpPlayer.score} điểm
            </span>
          </div>
        </div>

        {/* Gallery navigate button */}
        <button
          onClick={() => setShowGallery(true)}
          className="w-full bg-accent-500 hover:bg-accent-600 text-primary-950 font-black font-display py-4 rounded-xl text-lg shadow-glow transition-all select-none active:scale-97 flex items-center justify-center gap-2"
        >
          <BookOpen size={20} />
          XEM BỘ 5 THẺ TRI THỨC
        </button>

      </div>
    </div>
  );
};
