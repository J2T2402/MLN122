import React, { useState } from "react";
import { Button } from "../../../shared/components/UI";
import { UserCheck } from "lucide-react";

interface NicknameScreenProps {
  roomCode: string;
  onNicknameSaved: (nickname: string, avatar: string) => void;
}

export const NicknameScreen: React.FC<NicknameScreenProps> = ({
  roomCode,
  onNicknameSaved
}) => {
  const [nickname, setNickname] = useState<string>("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>("🐬");
  const [error, setError] = useState<string>("");

  const avatars = ["🐬", "🐠", "🦀", "🐙", "⛵", "🦑", "🏴‍☠️", "🐚"];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError("Tên phải dài tối thiểu 2 ký tự.");
      return;
    }
    if (trimmed.length > 16) {
      setError("Tên không được dài quá 16 ký tự.");
      return;
    }

    setError("");
    onNicknameSaved(trimmed, selectedAvatar);
  };

  const isFormValid = nickname.trim().length >= 2;

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-bg min-h-[calc(100dvh-60px)]">
      <div className="flex flex-col pt-4">
        <h2 className="text-2xl font-bold font-display text-primary-900 mb-2">
          Bạn tên là gì, thủy thủ? ⚓
        </h2>
        <p className="text-sm text-neutral-600 mb-6">
          Hãy đặt tên và linh vật đại diện để MC nhận diện bạn trên bảng chiếu.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              placeholder="Nhập tên của bạn..."
              value={nickname}
              maxLength={16}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 bg-white text-neutral-900 border-2 border-neutral-300 rounded-lg outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600 font-semibold text-lg"
            />
            <div className="flex justify-between text-xs text-neutral-500 px-1">
              <span>Mã phòng: {roomCode}</span>
              <span>{nickname.length}/16 ký tự</span>
            </div>
          </div>

          {error && (
            <p className="text-danger text-sm font-semibold text-center py-1">
              {error}
            </p>
          )}

          {/* Avatar selector grid */}
          <div className="flex flex-col gap-2 mt-4">
            <span className="text-sm font-bold text-neutral-700">Chọn linh vật đại diện:</span>
            <div className="grid grid-cols-4 gap-3 bg-white p-4 rounded-lg border border-neutral-300">
              {avatars.map((av) => (
                <button
                  type="button"
                  key={av}
                  onClick={() => setSelectedAvatar(av)}
                  className={`text-3xl p-2 rounded-lg border-2 transition-all duration-fast select-none active:scale-95 ${
                    selectedAvatar === av
                      ? "border-primary-600 bg-primary-100/50 scale-110"
                      : "border-transparent hover:bg-neutral-100"
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>

      <div className="w-full pb-4">
        <Button
          onClick={() => handleSubmit()}
          variant={isFormValid ? "primary" : "secondary"}
          size="xl"
          disabled={!isFormValid}
        >
          <UserCheck size={20} className="mr-2" />
          SẴN SÀNG KHỞI HÀNH
        </Button>
      </div>
    </div>
  );
};
