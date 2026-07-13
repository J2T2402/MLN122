import React, { useEffect, useState } from "react";
import { socket } from "../socket/client";
import { TeamId } from "../socket/events";

interface ReactionItem {
  id: string;
  emoji: string;
  xOffset: number; // random offset on x-axis
  teamId: TeamId | null;
  nickname?: string;
}

export const ReactionBar: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const emojis = ["😮", "🔥", "👏", "😂", "⚓"];

  const handleSend = (emoji: string) => {
    if (disabled) return;
    socket.emit("sendReaction", { emoji });
  };

  return (
    <div className="flex justify-center gap-4 py-2 px-4 bg-white/80 backdrop-blur-sm rounded-full shadow-md border border-neutral-300 pointer-events-auto">
      {emojis.map((emoji, idx) => (
        <button
          key={idx}
          onClick={() => handleSend(emoji)}
          disabled={disabled}
          className="text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center hover:scale-125 active:scale-95 transition-transform duration-fast select-none outline-none disabled:opacity-40 disabled:pointer-events-none"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export const ReactionLayer: React.FC = () => {
  const [reactions, setReactions] = useState<ReactionItem[]>([]);

  useEffect(() => {
    const handleReaction = (p: { emoji: string; teamId: TeamId | null; nickname?: string }) => {
      const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const xOffset = 10 + Math.random() * 80; // 10% to 90% width offset
      
      setReactions(prev => [
        ...prev,
        {
          id,
          emoji: p.emoji,
          xOffset,
          teamId: p.teamId,
          nickname: p.nickname
        }
      ]);

      // Remove after 2.5s
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 2500);
    };

    socket.on("reactionBroadcast", handleReaction);
    return () => {
      socket.off("reactionBroadcast", handleReaction);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {reactions.map(r => {
        const teamColors: Record<number, string> = {
          1: "border-red-500 shadow-red-300",
          2: "border-orange-500 shadow-orange-300",
          3: "border-yellow-500 shadow-yellow-300",
          4: "border-green-500 shadow-green-300",
          5: "border-cyan-500 shadow-cyan-300",
          6: "border-purple-500 shadow-purple-300",
        };
        const teamBorder = r.teamId ? teamColors[r.teamId] : "border-neutral-300 shadow-neutral-200";

        return (
          <div
            key={r.id}
            className="absolute bottom-20 flex flex-col items-center animate-fly"
            style={{
              left: `${r.xOffset}%`,
            }}
          >
            {/* Optional Nickname tooltip */}
            {r.nickname && (
              <span className="text-[10px] bg-neutral-900/80 text-white px-1.5 py-0.5 rounded mb-1 select-none font-medium whitespace-nowrap">
                {r.nickname}
              </span>
            )}
            
            {/* Floating emoji bubble */}
            <div className={`flex items-center justify-center text-2xl h-10 w-10 bg-white rounded-full border-2 shadow-lg ${teamBorder} select-none`}>
              {r.emoji}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes flyUp {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(-20px) scale(1.1);
          }
          100% {
            transform: translateY(-400px) scale(0.9);
            opacity: 0;
          }
        }
        .animate-fly {
          animation: flyUp 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};
