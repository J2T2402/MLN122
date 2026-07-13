import React from "react";
import { GamePhase, PublicQuestion, TeamId } from "../../../shared/socket/events";
import { Award, Compass, Trophy, Users, Zap, Flame, User, ShieldAlert } from "lucide-react";
import { TeamBadge, ScoreChip } from "../../../shared/components/UI";

interface ResultScreenProps {
  phase: GamePhase;
  // Reveal Props
  question?: PublicQuestion | null;
  correct?: any;
  stats?: any;
  yourResult?: {
    isCorrect: boolean;
    pointsEarned: number;
    speedBonus: number;
    streak: number;
  } | null;
  // Leaderboard Props
  leaderboard?: any;
  playerId?: string;
  teamId?: TeamId | null;
  // Victory/Ended Props
  endgameData?: any;
  
  score: number;
  streak: number;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  phase,
  question,
  correct,
  stats,
  yourResult,
  leaderboard,
  playerId,
  teamId,
  endgameData,
  score,
  streak
}) => {
  
  // ==========================================
  // RENDER 1: REVEAL / BOSS REVEAL
  // ==========================================
  if (phase === "REVEAL" || phase === "BOSS_REVEAL") {
    if (!yourResult) {
      return (
        <div className="flex-1 flex flex-col justify-between p-6 bg-bg min-h-[calc(100dvh-60px)]">
          <div className="flex flex-col pt-8 items-center text-center flex-1 justify-center">
            <ShieldAlert size={48} className="text-neutral-500 mb-4" />
            <h3 className="text-xl font-bold font-display text-neutral-800 mb-2">Bỏ lỡ câu hỏi</h3>
            <p className="text-neutral-500 text-sm max-w-xs">
              Bạn không nộp câu trả lời kịp thời trước thời gian deadline của server.
            </p>
            <div className="text-lg font-extrabold text-neutral-600 mt-4">+0 điểm</div>
          </div>
          <div className="w-full pb-4">
            <div className="bg-primary-900 text-white py-4 px-6 rounded-lg text-center font-semibold text-base shadow-md">
              ĐANG CHỜ MC GIẢI THÍCH THẺ TRI THỨC...
            </div>
          </div>
        </div>
      );
    }

    const isCorrect = yourResult.isCorrect;
    const isBoss = phase === "BOSS_REVEAL";

    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-bg min-h-[calc(100dvh-60px)]">
        <div className="flex flex-col pt-4 flex-1">
          {/* Correction Banner */}
          <div className={`flex flex-col items-center text-center p-6 rounded-xl border-2 mb-6 ${
            isCorrect
              ? "bg-success-bg border-success text-success shadow-sm"
              : "bg-danger-bg border-danger text-danger shadow-sm"
          }`}>
            <div className={`p-3 rounded-full mb-3 text-white ${isCorrect ? "bg-success" : "bg-danger"}`}>
              {isCorrect ? <Trophy size={32} /> : <ShieldAlert size={32} />}
            </div>
            <h2 className="text-2xl font-black font-display tracking-wide">
              {isCorrect ? "CHÍNH XÁC! ✓" : "KHÔNG CHÍNH XÁC ✗"}
            </h2>
            <div className="text-4xl font-extrabold font-mono mt-3">
              +{yourResult.pointsEarned}đ
            </div>
            {isBoss && (
              <span className="bg-boss text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 uppercase tracking-widest animate-pulse shadow-sm">
                Điểm nhân x2
              </span>
            )}
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-neutral-300 shadow-sm flex flex-col gap-1">
              <span className="text-xs text-neutral-500 font-bold font-mono tracking-wider uppercase flex items-center gap-1">
                <Zap size={14} className="text-amber-500" />
                Tốc độ
              </span>
              <span className="text-lg font-black text-neutral-800 font-mono">
                +{yourResult.speedBonus}đ
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-300 shadow-sm flex flex-col gap-1">
              <span className="text-xs text-neutral-500 font-bold font-mono tracking-wider uppercase flex items-center gap-1">
                <Flame size={14} className="text-orange-500" />
                Combo
              </span>
              <span className="text-lg font-black text-neutral-800 font-mono">
                {yourResult.streak >= 1 ? `x${(1 + Math.min(yourResult.streak * 0.1, 0.5)).toFixed(1)} (🔥${yourResult.streak})` : "Không có"}
              </span>
            </div>
          </div>

          {/* Class summary stats */}
          {stats && (
            <div className="bg-white p-4 rounded-xl border border-neutral-300 shadow-sm">
              <span className="text-sm font-bold text-neutral-600 mb-2 block">Thống kê cả lớp:</span>
              <div className="w-full bg-neutral-200 h-4 rounded-full overflow-hidden flex">
                <div
                  className="bg-success h-full transition-all duration-slow"
                  style={{ width: `${stats.classCorrectPct}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-neutral-500 mt-1.5 font-semibold">
                <span>Trả lời đúng: {stats.classCorrectPct}%</span>
                <span>Đáp án đúng: {question?.type === "selectwrong" ? correct?.wrongOptionId : correct?.optionId || "Đã chốt"}</span>
              </div>
            </div>
          )}
        </div>

        <div className="w-full pb-4 pt-6">
          <div className="bg-primary-900 text-white py-4 px-6 rounded-lg text-center font-semibold text-base shadow-md">
            ĐANG CHỜ MC LẬT THẺ TRI THỨC...
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER 2: LEADERBOARD
  // ==========================================
  if (phase === "LEADERBOARD" && leaderboard) {
    const selfRank = leaderboard.players.find((p: any) => p.playerId === playerId);
    
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-bg min-h-[calc(100dvh-60px)]">
        <div className="flex flex-col pt-4 flex-1">
          <h2 className="text-2xl font-bold font-display text-primary-900 mb-2 flex items-center gap-2">
            <Trophy size={24} className="text-accent-500" />
            Bảng Xếp Hạng
          </h2>
          <p className="text-sm text-neutral-600 mb-4">
            Theo dõi vị trí hạm đội của bạn và điểm số cá nhân.
          </p>

          {/* Self Rank stats card */}
          {selfRank && (
            <div className="bg-primary-900 text-white p-4 rounded-xl border border-primary-700 shadow-lg flex items-center justify-between mb-4 select-none">
              <div className="flex items-center gap-3">
                <div className="bg-accent-500 text-primary-950 p-2.5 rounded-lg font-display font-extrabold text-lg flex items-center justify-center h-11 w-11 shadow-sm">
                  #{selfRank.rank}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-primary-300 font-mono tracking-wider uppercase">Vị trí của bạn</span>
                  <span className="text-base font-bold truncate max-w-[120px]">{selfRank.nickname}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-primary-300 font-mono tracking-wider uppercase">Tích lũy</span>
                  <span className="text-base font-extrabold font-mono text-accent-300">⚡ {selfRank.score}đ</span>
                </div>
                {selfRank.streak >= 3 && (
                  <span className="font-extrabold text-orange-400 text-sm animate-pulse flex items-center">
                    🔥{selfRank.streak}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Teams list */}
          <div className="bg-white rounded-xl border border-neutral-300 shadow-sm p-4 flex-1 flex flex-col overflow-hidden max-h-[300px]">
            <span className="text-sm font-bold text-neutral-700 border-b border-neutral-200 pb-2 mb-2 flex items-center gap-1.5">
              <Users size={16} />
              Bảng xếp hạng Hạm đội (Đội)
            </span>
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
              {leaderboard.teams.map((t: any, idx: number) => {
                const isMyTeam = teamId === t.teamId;
                const pos = leaderboard.shipPositions?.find((p: any) => p.teamId === t.teamId);
                const progressPct = pos ? Math.round(pos.progress * 100) : 0;

                return (
                  <div
                    key={t.teamId}
                    className={`flex flex-col p-3 rounded-lg border transition-all ${
                      isMyTeam
                        ? "bg-primary-100/30 border-primary-400 font-bold scale-[1.01]"
                        : "bg-neutral-50 border-neutral-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 truncate max-w-[180px]">
                        <span className="font-mono text-sm opacity-60">#{idx + 1}</span>
                        <TeamBadge teamId={t.teamId} className="scale-90" />
                      </div>
                      <span className="font-mono text-sm font-bold text-neutral-800">
                        ⚡ {t.score}đ
                      </span>
                    </div>
                    {/* Ship progress bar */}
                    <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden relative shadow-inner">
                      <div
                        className="h-full rounded-full transition-all duration-slow"
                        style={{
                          width: `${progressPct}%`,
                          backgroundColor: `var(--team-${t.teamId})`
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-bold">
                      <span>Tiến độ: {progressPct}%</span>
                      <span>Trạm: {pos?.stationReached === "boss" ? "BOSS" : `Trạm ${pos?.stationReached || 1}`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="w-full pb-4 pt-6">
          <div className="bg-primary-900 text-white py-4 px-6 rounded-lg text-center font-semibold text-base shadow-md">
            ĐANG CHỜ MC MỞ CHẶNG KẾ TIẾP...
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER 3: VICTORY & ENDED
  // ==========================================
  if (phase === "VICTORY" || phase === "ENDED") {
    const finalData = endgameData || {};
    const winTeam = finalData.winnerTeam || { teamId: 1, teamName: "Hồng San Hô", score: 0 };
    
    // Find player rank in final players
    const finalPlayers = finalData.topPlayers || [];
    const myRankIdx = finalPlayers.findIndex((p: any) => p.playerId === playerId);
    const myFinalRank = myRankIdx !== -1 ? myRankIdx + 1 : 4; // fallback

    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-primary-900 text-white min-h-[calc(100dvh-60px)]">
        <div className="flex flex-col pt-8 items-center text-center flex-1 justify-center">
          <div className="bg-accent-500 text-primary-950 p-4 rounded-full shadow-glow animate-float mb-6">
            <Trophy size={48} />
          </div>

          <h2 className="text-3xl font-black font-display tracking-wider text-accent-500 mb-2 uppercase">
            CẬP CẢNG ĐÍCH!
          </h2>
          <p className="text-sm text-primary-300 max-w-xs mb-8 leading-snug">
            Nền kinh tế định hướng XHCN cập bến: Dân giàu - Nước mạnh - Dân chủ - Công bằng - Văn minh!
          </p>

          {/* Champion Team Display */}
          <div className="w-full max-w-xs bg-primary-800 rounded-xl border-2 border-accent-500 p-5 shadow-lg mb-6 flex flex-col items-center">
            <span className="text-[10px] font-bold text-accent-300 font-mono tracking-widest uppercase mb-1">
              🏆 Hạm đội vô địch 🏆
            </span>
            <span className="text-2xl font-black font-display text-white mt-1 border-b border-primary-700 pb-2 mb-2 w-full">
              {winTeam.teamName}
            </span>
            <span className="font-mono text-xl font-bold text-accent-500">
              ⚡ {winTeam.score}đ
            </span>
          </div>

          {/* Personal result */}
          <div className="flex flex-col gap-1 bg-primary-850 p-4 rounded-xl w-full max-w-xs border border-primary-700 shadow-sm">
            <span className="text-xs text-primary-300 font-bold font-mono tracking-wider uppercase mb-1">Hải trình cá nhân của bạn</span>
            <div className="flex items-center justify-between border-t border-primary-700/50 pt-2 mt-1">
              <span className="flex items-center gap-1.5 text-sm text-primary-200">
                <User size={16} />
                Thứ hạng:
              </span>
              <span className="font-display font-extrabold text-base text-accent-500">
                #{myFinalRank}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-primary-200">
                <Zap size={16} />
                Tổng điểm:
              </span>
              <span className="font-mono font-extrabold text-base text-accent-500">
                ⚡ {score}đ
              </span>
            </div>
          </div>
        </div>

        <div className="w-full pb-4 pt-8">
          <div className="bg-primary-950/80 border border-primary-700 text-primary-200 py-3.5 px-6 rounded-lg text-center font-bold text-sm select-none">
            🙌 CẢM ƠN THỦY THỦ ĐÃ THAM GIA HẢI TRÌNH!
          </div>
        </div>
      </div>
    );
  }

  return null;
};
