import React from "react";
import { PublicQuestion } from "../../../shared/socket/events";
import { Trophy, ShieldAlert, Award, Layers } from "lucide-react";

interface RevealSceneProps {
  phase: string;
  question: PublicQuestion | null;
  correct: any;
  stats: any;
}

export const RevealScene: React.FC<RevealSceneProps> = ({
  phase,
  question,
  correct,
  stats
}) => {
  if (!question || !correct || !stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-primary-200">
        <svg className="animate-spin h-12 w-12 text-accent-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-2xl">Đang tải đáp án...</p>
      </div>
    );
  }

  const isBoss = phase === "BOSS_REVEAL";
  const classCorrectPct = stats.classCorrectPct || 0;

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-8 p-6 lg:p-10 select-none relative overflow-hidden">
      {/* Left panel: Prompt & Answers list */}
      <div className="flex-[4] flex flex-col gap-6 justify-center">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-primary-300 font-mono tracking-widest uppercase">
            {isBoss ? "⛈ TRẬN BOSS REVEAL" : `⚓ TRẠM ${question.station} · ĐÁP ÁN ĐÚNG`}
          </span>
          <h2 className="text-3xl font-black font-display text-white leading-snug">
            {question.prompt}
          </h2>
        </div>

        {/* Display correct solution details depending on type */}
        <div className="flex flex-col gap-3">
          {(question.type === "mcq" || question.type === "selectwrong") && (
            <div className="flex flex-col gap-3">
              {question.options?.map(opt => {
                const isCorrect = question.type === "mcq" 
                  ? correct.optionId === opt.id 
                  : correct.wrongOptionId === opt.id;
                const pct = stats.optionPct?.[opt.id] || 0;

                return (
                  <div
                    key={opt.id}
                    className={`p-4 rounded-xl border-2 flex items-start gap-4 transition-all ${
                      isCorrect
                        ? "bg-success-bg/10 border-success text-success shadow-lg scale-102 font-bold"
                        : "bg-primary-900/30 border-primary-800 text-primary-200 opacity-60"
                    }`}
                  >
                    <span className={`h-8 w-8 rounded-full border-2 flex items-center justify-center font-mono font-bold text-base flex-shrink-0 ${
                      isCorrect ? "bg-success border-success text-white" : "border-neutral-500 text-neutral-400"
                    }`}>
                      {opt.id}
                    </span>
                    <div className="flex-1 flex justify-between items-center">
                      <span className="text-lg leading-snug">{opt.text}</span>
                      <span className="font-mono text-xl font-black bg-black/20 px-3 py-0.5 rounded-lg">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {question.type === "truefalse" && (
            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
              {question.statements?.map((stmt, idx) => {
                const correctVal = correct.statements?.[stmt.id];
                const correctPct = stats.statementCorrectPct?.[stmt.id] || 0;

                return (
                  <div key={stmt.id} className="bg-primary-900/30 border border-primary-800 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1 truncate max-w-[280px]">
                      <span className="text-sm font-semibold text-primary-200 truncate">
                        {idx + 1}. {stmt.text}
                      </span>
                      <span className={`text-base font-bold ${correctVal ? "text-success" : "text-danger"}`}>
                        Đáp án đúng: {correctVal ? "ĐÚNG" : "SAI"}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-primary-400 font-mono font-bold uppercase">Cả lớp đúng</span>
                        <span className="font-mono text-lg font-extrabold text-white">{correctPct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(question.type === "dragdrop" || question.type === "matching") && (
            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
              {question.items?.map(item => {
                const targetBucketId = correct.placement?.[item.id];
                const bucketName = question.buckets?.find(b => b.id === targetBucketId)?.name;
                const correctPct = stats.bucketCorrectPct?.[item.id] || 0;

                return (
                  <div key={item.id} className="bg-primary-900/30 border border-primary-800 p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1 truncate max-w-[280px]">
                      <span className="text-sm font-semibold text-primary-200 truncate">{item.text}</span>
                      <span className="text-sm font-bold text-accent-500">
                        Nhóm: {bucketName}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-primary-400 font-mono font-bold uppercase">Cả lớp đúng</span>
                        <span className="font-mono text-lg font-extrabold text-white">{correctPct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Class correctness display */}
      <div className="flex-[3] bg-primary-900/40 rounded-2xl border border-primary-800 p-8 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-sm relative">
        <div className="bg-success-bg/10 text-success p-4 rounded-full mb-4 shadow-sm border border-success/20">
          <Trophy size={48} />
        </div>
        
        <span className="text-sm font-bold text-primary-300 font-mono tracking-widest uppercase mb-1">
          Mức độ hiểu bài của lớp
        </span>
        <h3 className="text-8xl font-black font-mono text-white tracking-tighter drop-shadow-md leading-none">
          {classCorrectPct}%
        </h3>
        <p className="text-xl text-primary-200 font-semibold mt-4 max-w-xs leading-normal">
          thủy thủ đã vượt qua thử thách này xuất sắc!
        </p>

        {/* Circular progress bar */}
        <div className="w-full bg-primary-850 h-3 rounded-full overflow-hidden mt-8 border border-primary-800 relative">
          <div
            className="bg-success h-full rounded-full transition-all duration-slow"
            style={{ width: `${classCorrectPct}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};
