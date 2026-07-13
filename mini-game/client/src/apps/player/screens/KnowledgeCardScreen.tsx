import React from "react";
import { Award, BookOpen, Compass } from "lucide-react";
import { StationId } from "../../../shared/socket/events";

interface KnowledgeCardScreenProps {
  card: {
    title: string;
    body: string;
    badge?: string;
    station: StationId;
  };
  explain: string;
}

export const KnowledgeCardScreen: React.FC<KnowledgeCardScreenProps> = ({
  card,
  explain
}) => {
  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-bg min-h-[calc(100dvh-60px)]">
      <div className="flex flex-col pt-4 flex-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-accent-100 p-2.5 rounded-lg text-accent-600">
            <BookOpen size={24} className="animate-float" />
          </div>
          <h2 className="text-2xl font-bold font-display text-primary-900">
            Thẻ tri thức mở khóa!
          </h2>
        </div>
        <p className="text-sm text-neutral-600 mb-6">
          Đọc kỹ thẻ tóm tắt và nghe giáo viên giảng giải trước khi sang câu kế.
        </p>

        {/* Knowledge Card Visual */}
        <div className="bg-white rounded-xl border-2 border-accent-500 shadow-glow p-5 flex flex-col gap-4 relative overflow-hidden transition-all transform hover:scale-[1.01]">
          {/* Decorative stamp ribbon */}
          <div className="absolute top-0 right-0 bg-accent-500 text-primary-900 text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl shadow-sm select-none">
            {card.station === "boss" ? "BOSS CARD" : `TRẠM ${card.station}`}
          </div>

          <h3 className="text-lg font-extrabold font-display text-primary-950 pr-12 border-b border-neutral-200 pb-2 flex items-center gap-1.5">
            <Compass size={18} className="text-accent-500 animate-spin-slow" />
            {card.title}
          </h3>

          <div className="text-base text-neutral-800 font-semibold leading-relaxed whitespace-pre-line py-2">
            {card.body}
          </div>

          {/* Explanation slot */}
          {explain && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-800">
              <span className="font-bold block mb-1">💡 Giải thích chi tiết:</span>
              <p className="leading-snug">{explain}</p>
            </div>
          )}

          {/* Badge chip reward */}
          {card.badge && (
            <div className="flex items-center gap-2 mt-2 bg-accent-100/50 border border-accent-300 rounded-lg p-2.5">
              <div className="bg-accent-500 text-primary-950 p-1.5 rounded-full">
                <Award size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-neutral-500 font-mono tracking-wider uppercase leading-none">Huy hiệu đạt được</span>
                <span className="text-sm font-extrabold text-accent-600 leading-normal">{card.badge}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full pb-4 pt-6">
        <div className="bg-primary-900 text-white py-4 px-6 rounded-lg text-center font-semibold text-base shadow-md">
          <span className="animate-pulse flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent-500 animate-ping"></span>
            ĐANG CHỜ MC CHUYỂN BẢNG XẾP HẠNG...
          </span>
        </div>
      </div>
      
      <style>{`
        .animate-spin-slow {
          animation: spin 6s linear infinite;
        }
      `}</style>
    </div>
  );
};
