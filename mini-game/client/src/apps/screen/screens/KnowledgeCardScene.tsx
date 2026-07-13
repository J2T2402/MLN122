import React from "react";
import { BookOpen, Compass, Award } from "lucide-react";
import { StationId } from "../../../shared/socket/events";

interface KnowledgeCardSceneProps {
  card: {
    title: string;
    body: string;
    badge?: string;
    station: StationId;
  } | null;
  explain: string;
}

export const KnowledgeCardScene: React.FC<KnowledgeCardSceneProps> = ({
  card,
  explain
}) => {
  if (!card) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-primary-200">
        <svg className="animate-spin h-12 w-12 text-accent-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-2xl">Đang tải thẻ tri thức...</p>
      </div>
    );
  }

  const isBoss = card.station === "boss";

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-8 p-6 lg:p-10 select-none relative overflow-hidden items-center justify-between">
      {/* Left panel: Giant Card */}
      <div className="flex-[5] flex justify-center">
        <div className="w-full max-w-2xl bg-white text-neutral-900 rounded-2xl border-4 border-accent-500 shadow-glow p-8 flex flex-col gap-6 relative transform transition-transform hover:scale-[1.005]">
          
          {/* Ribbon */}
          <div className="absolute top-0 right-0 bg-accent-500 text-primary-950 text-xs font-black uppercase px-4 py-1.5 rounded-bl shadow-sm select-none">
            {isBoss ? "⛈ THẺ BOSS" : `TRẠM CHẶNG ${card.station}`}
          </div>

          <h2 className="text-3xl font-extrabold font-display text-primary-950 pr-20 border-b-2 border-neutral-200 pb-3 flex items-center gap-2">
            <Compass size={24} className="text-accent-500 animate-spin-slow" />
            {card.title}
          </h2>

          <p className="text-2xl text-neutral-800 font-semibold leading-relaxed whitespace-pre-line py-4 select-text">
            {card.body}
          </p>

          {/* Badge indicator */}
          {card.badge && (
            <div className="flex items-center gap-3.5 bg-accent-100/50 border border-accent-300 rounded-xl p-4 mt-2">
              <div className="bg-accent-500 text-primary-950 p-2.5 rounded-full shadow-md">
                <Award size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-neutral-500 font-mono tracking-widest uppercase leading-none mb-1">
                  Huy hiệu chặng đấu
                </span>
                <span className="text-xl font-extrabold text-accent-600 leading-normal">
                  {card.badge}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel: MC Explanation Display */}
      <div className="flex-[4] bg-primary-900/40 rounded-2xl border border-primary-800 p-8 flex flex-col h-[520px] shadow-2xl backdrop-blur-sm justify-between">
        <div className="flex flex-col gap-4 overflow-y-auto pr-2">
          <div className="flex items-center gap-2.5 text-white border-b border-primary-850 pb-3 mb-2">
            <BookOpen size={24} className="text-accent-500" />
            <span className="text-xl font-bold font-display">Tóm tắt nội dung giáo trình:</span>
          </div>

          <p className="text-lg text-primary-100 leading-relaxed whitespace-pre-line select-text">
            {explain || "MC đang giải thích cốt lõi kiến thức..."}
          </p>
        </div>

        <span className="text-sm font-bold text-primary-400 font-mono animate-pulse border-t border-primary-850 pt-4 block text-center uppercase tracking-widest">
          ● Đang trong thời gian MC giảng bài ●
        </span>
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
      `}</style>
    </div>
  );
};
