import React from "react";
import { ShieldAlert, Compass, Waves } from "lucide-react";

interface BossSceneProps {
  multiplier: number;
}

export const BossScene: React.FC<BossSceneProps> = ({ multiplier }) => {
  return (
    <div className="flex-1 flex flex-col p-12 justify-center items-center select-none relative overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-boss">
      
      {/* Decorative ocean waves background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden z-0">
        <Waves className="absolute -bottom-20 -left-20 text-white h-[450px] w-[450px] animate-pulse" />
        <Waves className="absolute -top-20 -right-20 text-purple-400 h-[450px] w-[450px] rotate-180 animate-pulse" />
      </div>

      <div className="flex flex-col items-center text-center max-w-4xl gap-8 z-10">
        {/* Warning Icon */}
        <div className="bg-boss border-4 border-purple-400 text-white p-6 rounded-full shadow-2xl animate-float">
          <ShieldAlert size={64} className="animate-pulse" />
        </div>

        {/* Warning Message */}
        <div className="flex flex-col gap-2">
          <span className="text-xl font-bold font-mono tracking-widest text-purple-300 uppercase">
            ⚡ CHẶNG CUỐI CAO TRÀO ⚡
          </span>
          <h2 className="text-7xl font-black font-display text-white leading-tight uppercase tracking-wide drop-shadow-lg">
            CƠN BÃO NHÀ Ở XÃ HỘI
          </h2>
          <p className="text-2xl text-primary-100 max-w-2xl mx-auto leading-relaxed mt-4">
            Đột bão tiến vào trận Boss cuối! Mức độ vận dụng giải quyết tình huống thực tế.
          </p>
        </div>

        {/* Points Multiplier Badge */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border-2 border-purple-400/50 p-6 flex flex-col items-center gap-1 shadow-2xl">
          <span className="text-sm font-bold text-purple-300 font-mono tracking-widest uppercase">Hệ số chặng đấu</span>
          <span className="text-6xl font-black text-accent-500 font-mono tracking-tight leading-none animate-pulse">
            ĐIỂM NHÂN X{multiplier}
          </span>
          <span className="text-xs text-primary-200 font-bold mt-2">
            Đội cuối bảng vẫn có cơ hội bứt phá lật kèo ngoạn mục!
          </span>
        </div>
      </div>

      <div className="absolute bottom-10 text-center text-primary-300 font-bold text-lg animate-bounce z-10">
        MC đang chuẩn bị mở các câu hỏi Boss tình huống...
      </div>
    </div>
  );
};
