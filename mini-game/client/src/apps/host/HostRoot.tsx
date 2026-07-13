import React, { useEffect, useState } from "react";
import { socket } from "../../shared/socket/client";
import { GamePhase, GameMode, StationId, TeamId } from "../../shared/socket/events";
import { Button, ConnectionBadge, TeamBadge, ScoreChip } from "../../shared/components/UI";
import { Play, Square, Pause, RotateCw, AlertTriangle, Users, Award, Shield, Eye, HelpCircle } from "lucide-react";

export const HostRoot: React.FC = () => {
  // MC auth credentials
  const [roomCode, setRoomCode] = useState<string>("");
  const [hostToken, setHostToken] = useState<string>("");
  const [connected, setConnected] = useState<boolean>(false);
  const [phase, setPhase] = useState<GamePhase | "INIT">("INIT");
  const [mode, setMode] = useState<GameMode>("chuan");
  const [resumePhase, setResumePhase] = useState<GamePhase | null>(null);

  // Roster details
  const [players, setPlayers] = useState<any[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<TeamId, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  const [currentStation, setCurrentStation] = useState<StationId | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [hasMoreInStation, setHasMoreInStation] = useState<boolean>(false);
  const [answeredCount, setAnsweredCount] = useState<number>(0);
  // MC-only correct-answer preview, delivered via host-only socket event (answers are NOT
  // in the client bundle anymore — closes the NFR4 answer-leak).
  const [questionInfo, setQuestionInfo] = useState<any>(null);
  
  // Create Room state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const storedCode = localStorage.getItem("hostRoomCode") || "";
    const storedToken = localStorage.getItem("hostToken") || "";
    
    if (storedCode && storedToken) {
      setRoomCode(storedCode);
      setHostToken(storedToken);
    }
  }, []);

  // Connect & Join room when credentials are ready
  const handleConnect = (code: string, token: string) => {
    setLoading(true);
    setError("");

    // Store in socket handshake
    socket.auth = { hostToken: token };
    socket.connect();

    socket.emit("joinRoom", { roomCode: code, role: "host" }, (ack) => {
      setLoading(false);
      if (ack.ok) {
        setRoomCode(code);
        setHostToken(token);
        setConnected(true);
        setPhase("LOBBY");
        
        localStorage.setItem("hostRoomCode", code);
        localStorage.setItem("hostToken", token);
      } else {
        setError(ack.error || "Không thể kết nối.");
        socket.disconnect();
      }
    });
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/create-room", { method: "POST" });
      const data = await res.json();
      if (data.roomCode && data.hostToken) {
        handleConnect(data.roomCode, data.hostToken);
      } else {
        setError("Không nhận được mã phòng.");
      }
    } catch (err: any) {
      setError("Mạng lỗi, không thể tạo phòng.");
    } finally {
      setLoading(false);
    }
  };

  // Always-mounted reconnect handler: after any socket auto-reconnect, re-join the room using
  // the stored host token so the MC console regains full control instead of dropping to INIT.
  useEffect(() => {
    const onConnect = () => {
      const code = localStorage.getItem("hostRoomCode");
      const token = localStorage.getItem("hostToken");
      if (code && token) {
        socket.auth = { hostToken: token };
        socket.emit("joinRoom", { roomCode: code, role: "host" }, (ack: any) => {
          if (ack?.ok) {
            setRoomCode(code);
            setHostToken(token);
            setConnected(true);
          }
        });
      }
    };
    socket.on("connect", onConnect);
    return () => { socket.off("connect", onConnect); };
  }, []);

  useEffect(() => {
    if (!connected) return;

    const onRoomState = (p: any) => {
      setPhase(p.phase);
      setMode(p.mode);
      setCurrentStation(p.currentStation);
      setCurrentQuestionId(p.currentQuestionId);
      setHasMoreInStation(!!p.hasMoreInStation);
      if (!p.currentQuestionId) setQuestionInfo(null);
      if (p.resumePhase) setResumePhase(p.resumePhase);
    };

    const onPlayerList = (p: any) => {
      setPlayers(p.players);
      setTeamCounts(p.counts.perTeam);
    };

    const onHostQuestionInfo = (p: any) => setQuestionInfo(p);

    const onAnswerLocked = (p: any) => {
      setAnsweredCount(p.answeredCount);
    };

    const onDisconnect = () => {
      // Keep the console's last state; the always-mounted connect handler re-joins on reconnect.
      setConnected(false);
    };

    // Cap nhat highlight nut che do khi BE xac nhan doi mode
    const onModeChanged = (p: any) => {
      if (p?.mode) setMode(p.mode);
    };

    // Phan hoi loi cho MC (vd lenh bi tu choi vi sai quyen host)
    const onErrorEvent = (p: any) => {
      console.error("[host errorEvent]", p);
      if (p?.fatal) alert(`Lỗi: ${p?.message || p?.code || "Không rõ"}`);
    };

    socket.on("roomState", onRoomState);
    socket.on("playerList", onPlayerList);
    socket.on("answerLocked", onAnswerLocked);
    socket.on("hostQuestionInfo", onHostQuestionInfo);
    socket.on("modeChanged", onModeChanged);
    socket.on("errorEvent", onErrorEvent);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("roomState", onRoomState);
      socket.off("playerList", onPlayerList);
      socket.off("answerLocked", onAnswerLocked);
      socket.off("hostQuestionInfo", onHostQuestionInfo);
      socket.off("modeChanged", onModeChanged);
      socket.off("errorEvent", onErrorEvent);
      socket.off("disconnect", onDisconnect);
    };
  }, [connected]);

  // Stepper Controller transitions
  const triggerAction = (actionName: string, payload?: any) => {
    socket.emit(actionName as any, payload || {});
  };

  const handleModeChange = (newMode: GameMode) => {
    triggerAction("setMode", { mode: newMode });
  };

  const handleForceClose = () => {
    if (confirm("Bạn có chắc muốn đóng phòng học này lập tức? Tất cả dữ liệu sẽ bị xóa.")) {
      triggerAction("endGame");
      localStorage.removeItem("hostRoomCode");
      localStorage.removeItem("hostToken");
      setPhase("INIT");
      setConnected(false);
      socket.disconnect();
    }
  };

  // Render initialization screen
  if (phase === "INIT") {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-primary-900 text-white p-6 min-h-screen">
        <div className="bg-primary-850 p-8 rounded-2xl border-2 border-primary-700 shadow-2xl max-w-md w-full flex flex-col gap-6 text-center">
          <div className="bg-accent-500 text-primary-900 p-4 rounded-full w-max mx-auto shadow-glow">
            <Shield size={36} />
          </div>
          
          <div className="flex flex-col">
            <h1 className="text-3xl font-black font-display tracking-wide text-accent-500">MC CONSOLE</h1>
            <p className="text-sm text-primary-300 mt-1">Hệ thống điều khiển hải trình lớp học</p>
          </div>

          {error && (
            <div className="bg-danger/25 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm font-semibold leading-snug">
              ⚠️ {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button onClick={handleCreateRoom} variant="warning" size="lg" loading={loading} className="w-full font-bold">
              TẠO PHÒNG HỌC MỚI ➕
            </Button>
            
            {roomCode && hostToken && (
              <Button
                onClick={() => handleConnect(roomCode, hostToken)}
                variant="secondary"
                size="lg"
                loading={loading}
                className="w-full border-primary-700 hover:bg-primary-800 text-primary-200"
              >
                KHÔI PHỤC PHÒNG {roomCode} 🔄
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active question metadata preview helper
  const previewQ = questionInfo;

  return (
    <div className="flex-1 flex flex-col bg-neutral-100 min-h-screen">
      {/* Host top bar */}
      <header className="bg-primary-950 text-white py-3 px-6 flex justify-between items-center border-b border-primary-800 shadow-md">
        <div className="flex items-center gap-3">
          <span className="bg-accent-500 text-primary-950 text-xs font-black px-2 py-0.5 rounded uppercase tracking-wider font-mono">
            MC CONSOLE
          </span>
          <span className="text-xl font-bold font-display">Phòng: {roomCode}</span>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionBadge connected={connected} />
          <Button onClick={handleForceClose} variant="danger" size="sm">
            Đóng phòng 🛑
          </Button>
        </div>
      </header>

      {/* Main console content: Grid layout */}
      <div className="flex-1 grid grid-cols-12 p-4 lg:p-6 gap-6">
        
        {/* LEFT COLUMN (6/12): Stepper Action Panel */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-neutral-300 p-6 shadow-sm flex flex-col gap-6">
            <div className="flex justify-between items-center border-b pb-4">
              <div className="flex flex-col">
                <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Trạng thái hiện tại</span>
                <span className="text-2xl font-black font-display text-primary-900 mt-0.5">
                  {phase}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Chế độ chơi</span>
                <span className="text-base font-bold text-primary-700 bg-primary-100 px-2 py-0.5 rounded mt-0.5">
                  {mode === "chuan" ? "Tiêu chuẩn (Lật thẻ)" : "Rút gọn (Bỏ lật thẻ)"}
                </span>
              </div>
            </div>

            {/* Phase Stepper Actions Switch */}
            <div className="flex flex-col gap-4">
              <span className="text-sm font-bold text-neutral-700">Lệnh điều khiển chặng:</span>
              
              {phase === "LOBBY" && (
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleModeChange("chuan")}
                      className={`flex-1 py-3 rounded-lg border-2 font-bold text-base transition-all select-none active:scale-97 ${
                        mode === "chuan"
                          ? "bg-primary-100 border-primary-600 text-primary-800"
                          : "bg-neutral-50 border-neutral-300 text-neutral-500 hover:bg-neutral-100"
                      }`}
                    >
                      Bản chuẩn (Có Lật thẻ)
                    </button>
                    <button
                      onClick={() => handleModeChange("lite")}
                      className={`flex-1 py-3 rounded-lg border-2 font-bold text-base transition-all select-none active:scale-97 ${
                        mode === "lite"
                          ? "bg-primary-100 border-primary-600 text-primary-800"
                          : "bg-neutral-50 border-neutral-300 text-neutral-500 hover:bg-neutral-100"
                      }`}
                    >
                      Bản rút gọn (Không Lật thẻ)
                    </button>
                  </div>
                  <Button onClick={() => triggerAction("startGame")} variant="primary" size="lg" className="font-bold">
                    Khởi Hành / Bắt Đầu Chia Đội ⛵
                  </Button>
                </div>
              )}

              {phase === "TEAM_SELECT" && (
                <Button onClick={() => triggerAction("openStation", { station: 1 })} variant="primary" size="lg" className="font-bold">
                  Mở Trạm 1: Đảo Khái Niệm 🧭
                </Button>
              )}

              {phase === "INTRO" && (
                <Button onClick={() => triggerAction("openStation", { station: 1 })} variant="primary" size="lg" className="font-bold">
                  Mở Câu Hỏi Trạm 1 🧭
                </Button>
              )}

              {phase === "STATION_OPEN" && (
                <Button
                  onClick={() => triggerAction("startAnswering", { questionId: currentQuestionId })}
                  variant="warning"
                  size="lg"
                  className="font-bold"
                >
                  Bắt Đầu Đồng Hồ Tính Giờ ⏳
                </Button>
              )}

              {phase === "ANSWERING" && (
                <div className="flex flex-col gap-3">
                  <div className="bg-amber-50 text-warning px-4 py-3 rounded-lg border border-amber-200 text-sm font-semibold flex items-center justify-between">
                    <span>Đang trả lời... ({answeredCount} người đã nộp)</span>
                  </div>
                  <Button
                    onClick={() => triggerAction("lockAnswers", { questionId: currentQuestionId })}
                    variant="danger"
                    size="lg"
                    className="font-bold"
                  >
                    Khóa Đáp Án Sớm 🔒
                  </Button>
                </div>
              )}

              {phase === "LOCKED" && (
                <Button
                  onClick={() => triggerAction("revealAnswer", { questionId: currentQuestionId })}
                  variant="success"
                  size="lg"
                  className="font-bold"
                >
                  Công Bố Đáp Án & Tính Điểm 🏆
                </Button>
              )}

              {(phase === "REVEAL" || phase === "BOSS_REVEAL") && (
                <div className="flex flex-col gap-3">
                  {mode === "chuan" && phase !== "BOSS_REVEAL" ? (
                    <Button
                      onClick={() => triggerAction("showKnowledgeCard", { questionId: currentQuestionId })}
                      variant="warning"
                      size="lg"
                      className="font-bold"
                    >
                      Mở Thẻ Tri Thức 💡
                    </Button>
                  ) : (
                    <Button onClick={() => triggerAction("showLeaderboard")} variant="primary" size="lg" className="font-bold">
                      Hiện Bảng Xếp Hạng 📊
                    </Button>
                  )}
                  {phase === "REVEAL" && hasMoreInStation && (
                    <Button
                      onClick={() => triggerAction("openStation", { station: currentStation })}
                      variant="secondary"
                      size="md"
                      className="font-bold border-primary-300"
                    >
                      ➕ Thêm 1 câu ở trạm này (bản CHUẨN)
                    </Button>
                  )}
                </div>
              )}

              {phase === "KNOWLEDGE_CARD" && (
                <div className="flex flex-col gap-3">
                  <Button onClick={() => triggerAction("showLeaderboard")} variant="primary" size="lg" className="font-bold">
                    Hiện Bảng Xếp Hạng 📊
                  </Button>
                  {hasMoreInStation && (
                    <Button
                      onClick={() => triggerAction("openStation", { station: currentStation })}
                      variant="secondary"
                      size="md"
                      className="font-bold border-primary-300"
                    >
                      ➕ Thêm 1 câu ở trạm này (bản CHUẨN)
                    </Button>
                  )}
                </div>
              )}

              {phase === "LEADERBOARD" && (
                <div className="flex flex-col gap-3">
                  {currentStation === 1 && (
                    <Button onClick={() => triggerAction("nextStation")} variant="primary" size="lg" className="font-bold">
                      Sang Trạm 2: Eo Biển Tất Yếu 🧭
                    </Button>
                  )}
                  {currentStation === 2 && (
                    <Button onClick={() => triggerAction("nextStation")} variant="primary" size="lg" className="font-bold">
                      Sang Trạm 3: Quần Đảo Đặc Trưng 🧭
                    </Button>
                  )}
                  {currentStation === 3 && (
                    <Button onClick={() => triggerAction("nextStation")} variant="primary" size="lg" className="font-bold">
                      Sang Trạm 4: Cảng Thể Chế 🧭
                    </Button>
                  )}
                  {currentStation === 4 && (
                    <Button onClick={() => triggerAction("startBoss")} variant="boss" size="lg" className="font-bold shadow-glow">
                      ẬP VÀO TRẬN BOSS CUỐI ⛈
                    </Button>
                  )}
                  {currentStation === "boss" && (
                    <Button onClick={() => triggerAction("endGame")} variant="success" size="lg" className="font-bold">
                      TỔNG KẾT & KẾT THÚC TRẬN ĐẤU 🏁
                    </Button>
                  )}
                </div>
              )}

              {phase === "BOSS_INTRO" && (
                <Button
                  onClick={() => triggerAction("startAnswering", { questionId: currentQuestionId })}
                  variant="boss"
                  size="lg"
                  className="font-bold"
                >
                  Bắt Đầu Đồng Hồ Câu Hỏi Boss ⛈⏳
                </Button>
              )}

              {phase === "BOSS_ANSWERING" && (
                <div className="flex flex-col gap-3">
                  <div className="bg-purple-50 text-boss px-4 py-3 rounded-lg border border-purple-200 text-sm font-semibold flex items-center justify-between">
                    <span>Trận Boss đang giải... ({answeredCount} đã nộp)</span>
                  </div>
                  <Button
                    onClick={() => triggerAction("lockAnswers", { questionId: currentQuestionId })}
                    variant="danger"
                    size="lg"
                    className="font-bold"
                  >
                    Khóa Đáp Án Boss 🔒
                  </Button>
                </div>
              )}

              {phase === "VICTORY" && (
                <Button onClick={() => triggerAction("endGame")} variant="success" size="lg" className="font-bold">
                  Công Bố 5 Thẻ Tri Thức Đã Đạt Được 🏁
                </Button>
              )}

              {phase === "ENDED" && (
                <div className="bg-neutral-800 text-white p-4 rounded-lg text-center font-bold">
                  🎉 HẢI TRÌNH ĐÃ HOÀN THÀNH XUẤT SẮC!
                </div>
              )}
            </div>
          </div>

          {/* EMERGENCY PANEL */}
          <div className="bg-white rounded-xl border border-neutral-300 p-6 shadow-sm flex flex-col gap-4">
            <span className="text-sm font-bold text-neutral-700 flex items-center gap-1.5 text-danger border-b pb-2">
              <AlertTriangle size={18} />
              Bảng kiểm soát khẩn cấp MC
            </span>
            <div className="flex gap-4">
              {phase === "PAUSED" ? (
                <Button
                  onClick={() => triggerAction("resumeGame")}
                  variant="success"
                  size="md"
                  className="flex-1 font-bold"
                >
                  Tiếp tục hải trình ▶
                </Button>
              ) : (
                <Button
                  onClick={() => triggerAction("pauseGame")}
                  variant="warning"
                  size="md"
                  className="flex-1 font-bold"
                  disabled={phase === "LOBBY" || phase === "ENDED"}
                >
                  Tạm dừng giảng giải ⏸
                </Button>
              )}
            </div>

            {/* Fallback / no-projector modes (per plan §NFR2 + Phụ lục A) */}
            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
              <span className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Chế độ dự phòng khi sự cố:</span>
              <div className="flex gap-3">
                <button
                  onClick={() => handleModeChange("fallback")}
                  className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-sm transition-all select-none active:scale-97 ${
                    mode === "fallback"
                      ? "bg-primary-100 border-primary-600 text-primary-800"
                      : "bg-neutral-50 border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  Quiz thuần (WebSocket lỗi)
                </button>
                <button
                  onClick={() => handleModeChange("no-projector")}
                  className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-sm transition-all select-none active:scale-97 ${
                    mode === "no-projector"
                      ? "bg-primary-100 border-primary-600 text-primary-800"
                      : "bg-neutral-50 border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  Không cần máy chiếu
                </button>
              </div>
              {(mode === "fallback" || mode === "no-projector") && (
                <button
                  onClick={() => handleModeChange("chuan")}
                  className="text-xs text-primary-600 underline self-start"
                >
                  ↩ Trở lại chế độ chuẩn
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (6/12): Question previews & Student Roster */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
          {/* Question Preview catalog metadata */}
          {previewQ && (
            <div className="bg-white rounded-xl border border-neutral-300 p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 text-primary-900 border-b pb-2">
                <Eye size={18} />
                <span className="text-base font-bold font-display">Xem trước đáp án (Chỉ MC thấy):</span>
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="text-base font-extrabold text-neutral-800">{previewQ.prompt}</h4>
                <div className="text-sm font-bold text-success mt-2 flex flex-col gap-1">
                  <span>Đáp án đúng:</span>
                  <pre className="font-sans text-xs bg-neutral-50 p-2 border rounded text-neutral-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {previewQ.answerText}
                  </pre>
                </div>
                {previewQ.explain && (
                  <div className="text-xs text-neutral-600 bg-primary-50 border border-primary-100 p-3 rounded mt-2">
                    <span className="font-bold block mb-1">💡 Hướng dẫn lý thuyết:</span>
                    <p className="leading-relaxed">{previewQ.explain}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Student Roster */}
          <div className="bg-white rounded-xl border border-neutral-300 p-5 shadow-sm flex-1 flex flex-col overflow-hidden max-h-[420px]">
            <div className="flex justify-between items-center pb-3 border-b mb-3 text-neutral-800">
              <span className="font-bold flex items-center gap-1.5 text-base">
                <Users size={18} />
                Danh sách thủy thủ ({players.length}):
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
              {players.map((p) => (
                <div key={p.playerId} className="flex justify-between items-center p-2.5 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="flex items-center gap-2.5 truncate max-w-[220px]">
                    <span className="text-2xl">{p.avatar || "🐬"}</span>
                    <div className="flex flex-col truncate">
                      <span className="text-sm font-bold text-neutral-800 truncate">{p.nickname}</span>
                      {p.teamId !== null && (
                        <TeamBadge teamId={p.teamId} className="scale-75 origin-left" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <ScoreChip score={p.score} />
                    <span className={`h-2 w-2 rounded-full ${p.connected ? "bg-success" : "bg-neutral-400"}`}></span>
                  </div>
                </div>
              ))}
              {players.length === 0 && (
                <div className="text-center text-neutral-400 italic py-10">Chưa có thủy thủ nào gia nhập.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HostRoot;
