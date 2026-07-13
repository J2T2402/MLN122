import React from "react";
import { TeamId } from "../../../shared/socket/events";
import { Compass, ShieldAlert, Award } from "lucide-react";

interface IntroScreenProps {
  teamId: TeamId | null;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ teamId }) => {
  const stations = [
    { num: "①", name: "Đảo Khái Niệm", desc: "Mức Nhớ — Khái niệm KTTT định hướng XHCN" },
    { num: "②", name: "Eo Biển Tất Yếu", desc: "Mức Hiểu — Tính tất yếu khách quan" },
    { num: "③", name: "Quần Đảo Đặc Trưng", desc: "Mức Phân Loại — 4 khía cạnh đặc trưng" },
    { num: "④", name: "Cảng Thể Chế", desc: "Mức Phân Biệt — Hoàn thiện thể chế" },
    { num: "⛈", name: "BOSS: Cơn Bão Nhà Ở Xã Hội", desc: "Mức Vận Dụng — Giải tình huống thực tiễn (Điểm x2)", isBoss: true },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-bg min-h-[calc(100dvh-60px)]">
      <div className="flex flex-col pt-4 flex-1">
        <h2 className="text-2xl font-bold font-display text-primary-900 mb-2">
          Hành trình 5 Trạm Tri Thức 🗺
        </h2>
        <p className="text-sm text-neutral-600 mb-6">
          Hạm đội của bạn sẽ neo qua 5 chặng thử thách để cập cảng đích. Trả lời đúng + nhanh để đạt combo điểm lớn.
        </p>

        {/* Journey timeline cards */}
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[360px] pr-1">
          {stations.map((st, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg border bg-white ${
                st.isBoss ? "border-purple-300 shadow-sm" : "border-neutral-300"
              }`}
            >
              <span className={`text-xl font-bold font-mono h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 select-none ${
                st.isBoss ? "bg-purple-100 text-boss" : "bg-primary-100 text-primary-600"
              }`}>
                {st.num}
              </span>
              <div className="flex flex-col">
                <span className={`text-base font-bold font-display ${st.isBoss ? "text-boss" : "text-neutral-800"}`}>
                  {st.name}
                </span>
                <span className="text-xs text-neutral-500 font-medium">
                  {st.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full pb-4 pt-6">
        <div className="bg-primary-900 text-white py-4 px-6 rounded-lg text-center font-semibold text-base shadow-md flex items-center justify-center gap-2">
          <Compass className="animate-spin" size={18} />
          <span>CHỜ MỞ TRẠM KẾ TIẾP...</span>
        </div>
      </div>
    </div>
  );
};
