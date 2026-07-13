import React, { useState, useEffect } from "react";
import { socket } from "../../../shared/socket/client";
import { Button } from "../../../shared/components/UI";
import { Compass, Ship } from "lucide-react";

interface JoinScreenProps {
  initialRoomCode?: string;
  onJoined: (roomCode: string, playerId: string, reconnectToken: string) => void;
}

export const JoinScreen: React.FC<JoinScreenProps> = ({
  initialRoomCode = "",
  onJoined
}) => {
  const [pin, setPin] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Prefill pin from query parameter if available
  useEffect(() => {
    if (initialRoomCode && initialRoomCode.length === 4) {
      setPin(initialRoomCode.split("").slice(0, 4));
    }
  }, [initialRoomCode]);

  // Handle single character input and advance focus
  const handlePinChange = (val: string, index: number) => {
    const cleanVal = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanVal.length > 1) return;

    const newPin = [...pin];
    newPin[index] = cleanVal;
    setPin(newPin);

    // Auto-advance focus to next input
    if (cleanVal !== "" && index < 3) {
      const nextInput = document.getElementById(`pin-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Backspace: clear current and focus previous
    if (e.key === "Backspace") {
      if (pin[index] === "" && index > 0) {
        const newPin = [...pin];
        newPin[index - 1] = "";
        setPin(newPin);
        
        const prevInput = document.getElementById(`pin-input-${index - 1}`);
        if (prevInput) {
          prevInput.focus();
        }
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (text.length > 0) {
      const newPin = ["", "", "", ""];
      for (let i = 0; i < text.length; i++) {
        newPin[i] = text[i];
      }
      setPin(newPin);
      
      // Focus last filled or first empty
      const targetIndex = Math.min(text.length, 3);
      const input = document.getElementById(`pin-input-${targetIndex}`);
      if (input) input.focus();
    }
  };

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullCode = pin.join("");
    if (fullCode.length !== 4) {
      setError("Vui lòng nhập đủ mã phòng 4 ký tự.");
      return;
    }

    setError("");
    setLoading(true);

    socket.emit("joinRoom", { roomCode: fullCode, role: "player" }, (ack) => {
      setLoading(false);
      if (ack.ok && ack.playerId && ack.reconnectToken) {
        onJoined(fullCode, ack.playerId, ack.reconnectToken);
      } else {
        setError(ack.error === "ROOM_NOT_FOUND" ? "Mã phòng không tồn tại. Thử lại." : ack.error || "Không thể kết nối.");
      }
    });
  };

  const isFormValid = pin.every(char => char !== "");

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-primary-900 text-white min-h-[calc(100dvh-60px)]">
      {/* Decorative Wave & Header */}
      <div className="flex flex-col items-center pt-8 text-center">
        <div className="bg-accent-500 text-primary-900 p-4 rounded-full shadow-glow animate-float mb-4">
          <Compass size={44} className="animate-spin-slow" />
        </div>
        <h1 className="text-3xl font-extrabold font-display leading-tight tracking-wide text-accent-500">
          HÀNH TRÌNH ĐỊNH HƯỚNG
        </h1>
        <p className="text-sm font-medium text-primary-300 mt-2">
          Vượt 5 Trạm Tri Thức · Chương 5
        </p>

        {/* Parallax SVG Sea waves */}
        <div className="w-full overflow-hidden h-12 relative opacity-30 mt-6 select-none">
          <svg className="absolute w-[200%] h-full top-0 left-0 animate-wave-slow fill-primary-300" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,60 C150,90 350,30 500,60 C650,90 850,30 1000,60 C1150,90 1300,30 1500,60 L1500,120 L0,120 Z" />
          </svg>
          <svg className="absolute w-[200%] h-full top-0 left-0 animate-wave-fast fill-accent-300 opacity-60" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,50 C150,20 300,80 500,50 C700,20 900,80 1100,50 L1100,120 L0,120 Z" />
          </svg>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleJoin} className="flex flex-col items-center my-auto w-full">
        <label className="text-base text-primary-300 font-semibold mb-4">
          Nhập mã phòng (4 ký tự)
        </label>
        
        <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
          {pin.map((char, index) => (
            <input
              key={index}
              id={`pin-input-${index}`}
              type="text"
              value={char}
              maxLength={1}
              autoFocus={index === 0}
              onChange={(e) => handlePinChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="w-14 h-16 text-center font-mono font-extrabold text-3xl bg-primary-800 text-accent-500 border-2 border-primary-700 rounded-lg outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500 shadow-lg"
            />
          ))}
        </div>

        {error && (
          <p className="text-danger bg-danger-bg border border-red-300 px-4 py-2 rounded-lg text-sm font-semibold max-w-xs text-center mb-4">
            {error}
          </p>
        )}
      </form>

      {/* Bottom Action Button */}
      <div className="w-full pb-4">
        <Button
          onClick={() => handleJoin()}
          variant={isFormValid ? "warning" : "secondary"}
          size="xl"
          disabled={!isFormValid}
          loading={loading}
        >
          <Ship size={20} className="mr-2" />
          VÀO PHÒNG CHƠI
        </Button>
      </div>

      <style>{`
        @keyframes waveMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-wave-slow {
          animation: waveMove 15s linear infinite;
        }
        .animate-wave-fast {
          animation: waveMove 8s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
      `}</style>
    </div>
  );
};
