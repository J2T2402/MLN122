import React from "react";
import { Award, Compass, Trophy, Users, Ship } from "lucide-react";
import { TeamBadge } from "../../../shared/components/UI";

interface LeaderboardSceneProps {
  leaderboard: any;
}

export const LeaderboardScene: React.FC<LeaderboardSceneProps> = ({
  leaderboard
}) => {
  if (!leaderboard) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-primary-200">
        <svg className="animate-spin h-12 w-12 text-accent-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-2xl">Đang cập nhật bảng điểm...</p>
      </div>
    );
  }

  const sortedTeams = [...leaderboard.teams];
  const sortedPlayers = [...leaderboard.players];

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-8 p-6 lg:p-10 select-none relative overflow-x-hidden overflow-y-auto">
      {/* Left panel: Team Standing & Ship journey maps */}
      <div className="flex-[4] flex flex-col gap-4 justify-center min-h-0">
        <div className="flex items-center gap-2.5 mb-2">
          <Compass className="text-accent-500 animate-pulse" size={32} />
          <h2 className="text-4xl font-black font-display text-white tracking-wide">
            TIẾN ĐỘ HẠM ĐỘI
          </h2>
        </div>

        {/* Ocean waves / ships racing area */}
        <div className="bg-primary-900/30 border border-primary-800 rounded-2xl p-6 flex flex-col gap-3 shadow-2xl backdrop-blur-sm relative">
          {sortedTeams.map((team, idx) => {
            const shipPos = leaderboard.shipPositions?.find((pos: any) => pos.teamId === team.teamId);
            const progress = shipPos ? shipPos.progress : 0;
            const progressPct = Math.round(progress * 100);

            return (
              <div key={team.teamId} className="flex flex-col gap-1.5 w-full relative">
                <div className="flex items-center justify-between text-base font-bold text-white z-10">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm opacity-50">#{idx + 1}</span>
                    <TeamBadge teamId={team.teamId} className="scale-90" />
                  </div>
                  <span className="font-mono text-lg font-black text-accent-500">
                    {team.score}đ
                  </span>
                </div>

                {/* Progress bar track — no overflow-hidden so the ⛵ marker (taller than the track) isn't clipped */}
                <div className="w-full bg-primary-950 h-5 rounded-full relative border border-primary-800 shadow-inner">
                  {/* Progress filler */}
                  <div
                    className="h-full rounded-full transition-all duration-slow shadow-md"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: `var(--team-${team.teamId})`
                    }}
                  ></div>
                  
                  {/* Floating ship overlay */}
                  <div
                    className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 text-2xl transition-all duration-slow flex items-center justify-center bg-white h-7 w-7 rounded-full border shadow-lg border-neutral-300"
                    style={{
                      left: `${progressPct}%`,
                    }}
                  >
                    ⛵
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-primary-300 font-bold font-mono">
                  <span>Hải trình: {progressPct}%</span>
                  <span>Trạm đã qua: {shipPos?.stationReached === "boss" ? "BOSS" : `Trạm ${shipPos?.stationReached || 1}`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: Top Individual Players */}
      <div className="flex-[3] bg-primary-900/40 rounded-2xl border border-primary-800 p-6 flex flex-col h-[520px] shadow-2xl backdrop-blur-sm justify-between">
        <div className="flex flex-col gap-4 overflow-hidden h-full">
          <div className="flex items-center gap-2 text-white border-b border-primary-850 pb-4 mb-2">
            <Trophy size={24} className="text-accent-500" />
            <span className="text-2xl font-bold font-display">Bảng xếp hạng cá nhân:</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
            {sortedPlayers.map((player, idx) => {
              const bgColors = [
                "bg-yellow-500/10 border-yellow-500 text-yellow-500",
                "bg-slate-300/10 border-slate-300 text-slate-300",
                "bg-amber-600/10 border-amber-600 text-amber-600",
              ];
              const rankColor = idx < 3 ? bgColors[idx] : "bg-primary-850/60 border-primary-800 text-primary-300";

              return (
                <div
                  key={player.playerId}
                  className="flex items-center justify-between p-3 bg-primary-850/30 rounded-xl border border-primary-800 shadow-sm animate-scale-in"
                >
                  <div className="flex items-center gap-3 truncate max-w-[200px]">
                    <span className={`h-8 w-8 rounded-full border-2 flex items-center justify-center font-display font-extrabold text-base flex-shrink-0 ${rankColor}`}>
                      {idx + 1}
                    </span>
                    <div className="flex flex-col truncate">
                      <span className="text-base font-bold text-white truncate">{player.nickname}</span>
                      <TeamBadge teamId={player.teamId} className="scale-75 origin-left mt-0.5" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-black text-accent-500">
                      ⚡ {player.score}đ
                    </span>
                    {player.streak >= 3 && (
                      <span className="text-xs font-bold text-orange-400 animate-pulse">
                        🔥{player.streak}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {sortedPlayers.length === 0 && (
              <span className="text-primary-400 italic text-center py-10 text-lg">Chưa có bảng xếp hạng</span>
            )}
          </div>
        </div>

        <span className="text-sm font-bold text-primary-400 font-mono animate-pulse border-t border-primary-850 pt-4 block text-center uppercase tracking-widest mt-2 select-none">
          ● Đang trong thời gian MC thống kê điểm ●
        </span>
      </div>

      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};
