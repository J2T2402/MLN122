import React from "react";
import { PublicQuestion } from "../../../shared/socket/events";
import { CountdownRing } from "../../../shared/components/CountdownRing";
import { Compass, HelpCircle, Layers, ShieldAlert, Users } from "lucide-react";

interface ChallengeSceneProps {
  phase: string;
  question: PublicQuestion | null;
  deadlineTs: number | null;
  clockOffset: number;
  durationSec: number;
  players: any[];
  answeredCount: number;
}

export const ChallengeScene: React.FC<ChallengeSceneProps> = ({
  phase,
  question,
  deadlineTs,
  clockOffset,
  durationSec,
  players,
  answeredCount
}) => {
  if (!question) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-primary-200">
        <svg className="animate-spin h-12 w-12 text-accent-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-2xl">Đang tải câu hỏi...</p>
      </div>
    );
  }

  const isBoss = question.station === "boss";
  const activePlayers = players.filter(p => p.connected && p.teamId !== null);
  const totalToAnswer = activePlayers.length;

  return (
    <div className={`flex-1 flex flex-col justify-between p-6 lg:p-12 select-none relative ${isBoss ? "bg-purple-950/20" : ""}`}>
      {/* Top station marker */}
      <div className="flex items-center justify-between border-b border-primary-800 pb-4 z-10">
        <div className="flex flex-col">
          <span className="text-xl font-bold text-primary-300 font-mono tracking-widest uppercase">
            {isBoss ? "⛈ TRẬN BOSS THỬ THÁCH" : `⚓ TRẠM ${question.station} · ${question.stationName}`}
          </span>
          <span className="text-2xl font-bold text-accent-500 mt-1">
            Chủ đề: {question.topic} · Mức {question.learningLevel?.toUpperCase() || "ÔN TẬP"}
          </span>
        </div>

        {/* Big countdown display */}
        <div className="scale-[1.6] transform origin-right">
          <CountdownRing
            deadlineTs={deadlineTs}
            clockOffset={clockOffset}
            durationSec={durationSec}
          />
        </div>
      </div>

      {/* Center Prompt */}
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto my-auto gap-8 z-10">
        {isBoss && (
          <span className="bg-boss border-2 border-purple-400 text-white text-base font-extrabold px-4 py-1.5 rounded-full uppercase tracking-widest animate-pulse shadow-lg select-none">
            ⚡ ĐIỂM NHÂN X2 BOSS ⚡
          </span>
        )}
        
        {/* Giant Question prompt */}
        <h2 className="text-3xl md:text-5xl font-black font-display text-white leading-snug drop-shadow-md">
          {question.prompt}
        </h2>

        {/* Display generic structures, e.g. for drag/drop or matching, show categories without revealing answers */}
        {question.type === "truefalse" && (
          <div className="flex justify-center gap-6 mt-4">
            <span className="flex items-center gap-2 bg-primary-900 border border-primary-800 px-4 py-2 rounded-xl text-lg font-bold text-primary-200">
              <ShieldAlert size={20} className="text-amber-500" />
              {question.statements?.length} Nhận định Đúng/Sai
            </span>
          </div>
        )}

        {(question.type === "dragdrop" || question.type === "matching") && (
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <span className="flex items-center gap-2 bg-primary-900 border border-primary-800 px-4 py-2 rounded-xl text-lg font-bold text-primary-200">
              <Layers size={20} className="text-accent-500" />
              Phân loại {question.items?.length} mục vào {question.buckets?.length} nhóm:
            </span>
            <div className="flex gap-2">
              {question.buckets?.map(b => (
                <span key={b.id} className="bg-white/10 px-3 py-1 rounded-lg text-sm font-semibold text-white border border-white/20">
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom stats details */}
      <div className="flex justify-between items-center border-t border-primary-800 pt-6 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-primary-900 p-3 rounded-xl border border-primary-800 text-white shadow-md">
            <Users size={24} className="animate-pulse text-accent-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-primary-300 font-mono tracking-wider uppercase">Sinh viên đã nộp bài</span>
            <span className="text-2xl font-black font-mono text-white leading-tight">
              {answeredCount} / {totalToAnswer || "--"} người
            </span>
          </div>
        </div>

        {phase === "LOCKED" ? (
          <div className="bg-danger text-white font-extrabold text-2xl px-8 py-3 rounded-xl border border-red-500 shadow-lg animate-pulse uppercase tracking-wider">
            🔒 ĐÃ KHÓA ĐÁP ÁN — ĐANG ĐỢI MC CÔNG BỐ
          </div>
        ) : (
          <span className="text-lg font-semibold text-primary-300 font-mono animate-bounce tracking-wide select-none">
            ● HÃY CHỌN TRÊN ĐIỆN THOẠI CỦA BẠN ●
          </span>
        )}
      </div>
    </div>
  );
};
