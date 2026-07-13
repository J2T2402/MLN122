import React from "react";
import { Compass, Ship, Waves } from "lucide-react";

export const IntroScene: React.FC = () => {
  const stations = [
    { num: "1", name: "Đảo Khái Niệm", topic: "Khái niệm KTTT định hướng XHCN" },
    { num: "2", name: "Eo Biển Tất Yếu", topic: "Tính tất yếu khách quan" },
    { num: "3", name: "Quần Đảo Đặc Trưng", topic: "4 khía cạnh đặc trưng" },
    { num: "4", name: "Cảng Thể Chế", topic: "Hoàn thiện thể chế" },
    { num: "⛈", name: "BOSS: Bão NOXH", topic: "Ghép công cụ & Vận dụng (x2)", isBoss: true },
  ];

  return (
    <div className="flex-1 flex flex-col p-10 justify-between select-none relative">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden z-0">
        <Waves className="absolute -bottom-20 -left-20 text-white h-[400px] w-[400px] animate-pulse" />
      </div>

      <div className="flex flex-col gap-3 text-center pt-4 z-10">
        <h1 className="text-5xl font-black font-display tracking-wider text-accent-500 flex items-center justify-center gap-3">
          <Compass className="animate-spin-slow" size={48} />
          HẢI TRÌNH 5 TRẠM TRI THỨC
        </h1>
        <p className="text-2xl text-primary-200 max-w-3xl mx-auto leading-relaxed">
          Cả lớp cầm lái con tàu kinh tế vượt qua 5 trạm thử thách để cập bến cảng đích văn minh.
        </p>
      </div>

      {/* Horizontal timeline journey map */}
      <div className="flex items-center justify-center w-full my-auto px-10 z-10">
        <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-between w-full max-w-5xl relative gap-6 lg:gap-0">
          
          {/* Continuous path line */}
          <div className="hidden lg:block absolute top-14 left-6 right-6 h-1 bg-gradient-to-r from-primary-600 via-primary-500 to-boss z-0"></div>

          {stations.map((st, idx) => (
            <div key={idx} className="flex flex-col items-center gap-4 z-10 w-44">
              {/* Station Circle Node */}
              <div className={`h-28 w-28 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl transition-transform transform hover:scale-105 ${
                st.isBoss 
                  ? "bg-boss border-purple-400 text-white shadow-purple-900/50" 
                  : "bg-primary-850 border-primary-600 text-primary-200"
              }`}>
                {st.isBoss ? (
                  <span className="text-3xl font-black font-display text-accent-500">BOSS</span>
                ) : (
                  <>
                    <span className="text-xs font-bold font-mono text-primary-400">TRẠM</span>
                    <span className="text-4xl font-extrabold font-mono text-white leading-none">{st.num}</span>
                  </>
                )}
              </div>

              {/* Station Description */}
              <div className="flex flex-col text-center">
                <span className={`text-xl font-bold font-display leading-tight ${st.isBoss ? "text-accent-500" : "text-white"}`}>
                  {st.name}
                </span>
                <span className="text-xs text-primary-300 font-semibold leading-normal mt-1 max-w-[150px] mx-auto">
                  {st.topic}
                </span>
              </div>
            </div>
          ))}

          {/* Final destination node */}
          <div className="flex flex-col items-center gap-4 z-10 w-48">
            <div className="h-28 w-28 rounded-full bg-accent-500 border-4 border-accent-300 text-primary-950 flex flex-col items-center justify-center shadow-glow">
              <Ship className="animate-bounce" size={40} />
            </div>
            <div className="flex flex-col text-center">
              <span className="text-xl font-black font-display text-accent-500 leading-tight">
                CẢNG ĐÍCH
              </span>
              <span className="text-xs text-accent-300 font-bold leading-normal mt-1">
                Dân giàu - Nước mạnh - Dân chủ - Công bằng - Văn minh
              </span>
            </div>
          </div>

        </div>
      </div>

      <div className="text-center pb-6 text-primary-400 font-semibold text-lg animate-pulse z-10">
        Đang đợi MC bắt đầu mở Trạm 1...
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 10s linear infinite;
        }
      `}</style>
    </div>
  );
};
