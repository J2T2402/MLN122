import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface LobbySceneProps {
  roomCode: string;
  players: any[];
  connectedCount: number;
}

export const LobbyScene: React.FC<LobbySceneProps> = ({
  roomCode,
  players,
  connectedCount
}) => {
  const activePlayers = players.filter(p => p.connected);

  // Sinh mã QR NGAY TRONG TRÌNH DUYỆT bằng thư viện local (không gọi API ngoài) → chạy được
  // cả khi lớp học chỉ có mạng LAN / không internet. QR mã hoá URL vào phòng động theo domain.
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const joinUrl = `${window.location.origin}/play?room=${roomCode}`;
  useEffect(() => {
    if (!roomCode) { setQrDataUrl(""); return; }
    let cancelled = false;
    QRCode.toDataURL(joinUrl, { width: 380, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [roomCode, joinUrl]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-8 p-6 lg:p-10 items-center justify-between select-none">
      {/* Left panel: Info & QR */}
      <div className="flex-[4] flex flex-col gap-6 justify-center">
        <h1 className="text-6xl font-black font-display tracking-wider text-white">
          SẴN SÀNG KHỞI HÀNH!
        </h1>
        <p className="text-2xl text-primary-200 leading-snug">
          Quét mã QR bằng điện thoại hoặc truy cập địa chỉ bên dưới và nhập mã phòng để lên tàu.
        </p>

        <div className="flex items-center gap-10 bg-primary-900/50 p-6 rounded-2xl border border-primary-800 backdrop-blur-sm shadow-xl w-max">
          <div className="bg-white p-3 rounded-xl border border-neutral-300 shadow-glow flex-shrink-0">
            {roomCode && qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code vào phòng ${roomCode}`}
                className="h-[280px] w-[280px] select-none"
              />
            ) : (
              <div className="h-[280px] w-[280px] bg-neutral-200 animate-pulse rounded-lg"></div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-primary-300 font-mono tracking-widest uppercase">Nhập mã phòng:</span>
              <span className="text-8xl font-black font-mono text-accent-500 tracking-wider drop-shadow-md select-text">
                {roomCode || "----"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-primary-300 font-mono tracking-widest uppercase">Địa chỉ web:</span>
              <span className="text-xl font-mono text-white underline select-text">
                {window.location.hostname}/play
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel: Roster */}
      <div className="flex-[3] bg-primary-900/40 rounded-2xl border border-primary-800 p-6 flex flex-col h-[520px] shadow-2xl backdrop-blur-sm">
        <div className="flex justify-between items-center pb-4 border-b border-primary-800 mb-4 text-white">
          <span className="text-2xl font-bold font-display">Thủy thủ đã lên tàu:</span>
          <span className="text-xl font-mono font-bold bg-primary-850 px-3.5 py-1 rounded-full border border-primary-700">
            {connectedCount} người
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-3 xl:grid-cols-4 gap-2 content-start">
          {activePlayers.map((p) => (
            <div
              key={p.playerId}
              className="flex items-center gap-2 p-2 bg-primary-850/60 rounded-lg border border-primary-800 shadow-sm animate-scale-in"
            >
              <span className="text-2xl select-none flex-shrink-0">{p.avatar || "🐬"}</span>
              <span className="text-base font-bold text-white truncate">
                {p.nickname}
              </span>
            </div>
          ))}
          {activePlayers.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center h-full text-primary-400 italic text-xl gap-2 mt-20">
              <span>Đang đợi thủy thủ join...</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};
