import React from "react";
import { Ship, Users } from "lucide-react";

interface PlayerRosterItem {
  playerId: string;
  nickname: string;
  avatar?: string;
  connected: boolean;
}

interface LobbyScreenProps {
  roomCode: string;
  players: PlayerRosterItem[];
  playerId: string;
  nickname: string;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  roomCode,
  players,
  playerId,
  nickname
}) => {
  const activePlayers = players.filter(p => p.connected);

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-bg min-h-[calc(100dvh-60px)]">
      <div className="flex flex-col pt-4 flex-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary-100 p-2.5 rounded-lg text-primary-600">
            <Ship size={24} className="animate-bounce" />
          </div>
          <h2 className="text-2xl font-bold font-display text-primary-900">
            Chờ thuyền trưởng...
          </h2>
        </div>
        <p className="text-sm text-neutral-600 mb-6">
          Giữ màn hình sáng. Trận chiến tri thức sẽ khởi hành ngay khi MC bấm bắt đầu.
        </p>

        {/* Players list card */}
        <div className="bg-white rounded-xl border border-neutral-300 shadow-sm p-4 flex-1 flex flex-col min-h-[250px] max-h-[380px]">
          <div className="flex justify-between items-center pb-3 border-b border-neutral-200 mb-3 font-semibold text-sm text-neutral-700">
            <span className="flex items-center gap-1.5">
              <Users size={16} />
              Đã lên tàu:
            </span>
            <span className="font-mono bg-neutral-100 px-2 py-0.5 rounded">
              {activePlayers.length} thủy thủ
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
            {players.map((p) => {
              const isSelf = p.playerId === playerId;
              return (
                <div
                  key={p.playerId}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                    isSelf
                      ? "bg-primary-100/50 border-primary-300 font-bold"
                      : "bg-neutral-50 border-neutral-200"
                  } ${!p.connected ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl select-none">{p.avatar || "🐬"}</span>
                    <span className={`text-base truncate max-w-[200px] ${isSelf ? "text-primary-800" : "text-neutral-800"}`}>
                      {p.nickname} {isSelf && <span className="text-xs font-semibold text-primary-600">(bạn)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.connected ? "bg-success" : "bg-neutral-400"}`}></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Waiting panel */}
      <div className="w-full pb-4 pt-6">
        <div className="flex flex-col items-center gap-2 bg-primary-900 text-white py-4 px-6 rounded-lg text-center font-semibold text-base shadow-md">
          <span className="animate-pulse flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent-500 animate-ping"></span>
            ĐANG CHỜ MC BẮT ĐẦU...
          </span>
          <span className="text-xs text-primary-300 font-mono tracking-wide">MÃ PIN: {roomCode}</span>
        </div>
      </div>
    </div>
  );
};
