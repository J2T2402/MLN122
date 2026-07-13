import React, { useEffect, useMemo } from "react";
import { PublicQuestion, AnswerPayload, TeamId, GamePhase } from "../../../shared/socket/events";
import { CountdownRing } from "../../../shared/components/CountdownRing";
import { Button } from "../../../shared/components/UI";
import { Send, CheckSquare, Layers, HelpCircle } from "lucide-react";

interface ChallengeScreenProps {
  question: PublicQuestion;
  phase: GamePhase;
  deadlineTs: number | null;
  clockOffset: number;
  durationSec: number;
  answerState: "idle" | "selecting" | "submitting" | "submitted" | "locked" | "revealed";
  localAnswer: any;
  setLocalAnswer: (ans: any) => void;
  onSubmitAnswer: (ans: AnswerPayload) => void;
  streak: number;
}

export const ChallengeScreen: React.FC<ChallengeScreenProps> = ({
  question,
  phase,
  deadlineTs,
  clockOffset,
  durationSec,
  answerState,
  localAnswer,
  setLocalAnswer,
  onSubmitAnswer,
  streak
}) => {
  // Anti-cheat (spec §7 / NFR4): xáo trộn thứ tự lựa chọn & thẻ kéo trên TỪNG máy.
  // Ổn định theo từng câu nhờ useMemo (khoá theo questionId); chấm điểm dựa trên id nên
  // đổi thứ tự hiển thị không ảnh hưởng kết quả. Nhận định Đúng/Sai giữ nguyên thứ tự.
  const q = useMemo(() => {
    const shuffle = (arr?: any[]) => {
      if (!arr) return arr;
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return {
      ...question,
      options: shuffle(question.options),
      items: shuffle(question.items),
      buckets: shuffle(question.buckets),
    } as PublicQuestion;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.questionId]);

  const isBoss = q.station === "boss";
  // Server chỉ nhận bài khi phòng ở ANSWERING/BOSS_ANSWERING. Ở STATION_OPEN câu hỏi đã hiện
  // nhưng MC chưa "Cho trả lời" -> phải chặn nộp (nếu không sẽ dính lỗi NOT_ANSWERING).
  const answeringOpen = phase === "ANSWERING" || phase === "BOSS_ANSWERING";
  const waitingToStart = phase === "STATION_OPEN" || phase === "BOSS_INTRO";
  const isLocked = phase === "LOCKED" || answerState === "locked";
  const isReadOnly = !answeringOpen || answerState === "submitting" || answerState === "submitted" || answerState === "locked" || answerState === "revealed";

  // Check if answer is fully completed to enable submit button
  const isAnswerComplete = () => {
    if (!localAnswer) return false;

    if (q.type === "mcq" || q.type === "selectwrong") {
      return !!localAnswer.optionId;
    }

    if (q.type === "truefalse") {
      const answers = localAnswer.answers || {};
      const statementsCount = q.statements?.length || 0;
      return Object.keys(answers).length === statementsCount;
    }

    if (q.type === "dragdrop" || q.type === "matching") {
      const placement = localAnswer.placement || {};
      const itemsCount = q.items?.length || 0;
      return Object.keys(placement).length === itemsCount;
    }

    return false;
  };

  const handleSubmit = () => {
    if (isAnswerComplete() && !isReadOnly) {
      onSubmitAnswer(localAnswer);
    }
  };

  return (
    <div className={`flex-1 flex flex-col justify-between p-6 ${isBoss ? "bg-purple-900/5" : "bg-bg"} min-h-[calc(100dvh-60px)]`}>
      {/* Header Info */}
      <div className="flex flex-col gap-2">
        {/* Meta + countdown pinned below the status bar so the timer stays visible while the
            player scrolls a long question. */}
        <div className="flex items-center justify-between sticky top-[52px] z-20 -mx-6 px-6 pt-1 pb-2 bg-bg">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-neutral-500 font-mono tracking-wide uppercase">
              {isBoss ? "⛈ TRẬN BOSS" : `⚓ TRẠM ${q.station}`} · {q.stationName}
            </span>
            <span className="text-sm font-semibold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full w-max mt-0.5">
              Chủ đề: {q.topic}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {streak >= 3 && (
              <span className="text-sm font-extrabold text-orange-600 bg-orange-100 px-2 py-0.5 rounded border border-orange-200 animate-pulse">
                🔥 x{streak}
              </span>
            )}
            <CountdownRing
              deadlineTs={deadlineTs}
              clockOffset={clockOffset}
              durationSec={durationSec}
            />
          </div>
        </div>

        {/* Prompt Card */}
        <div className="bg-white p-4 rounded-xl border border-neutral-300 shadow-sm mt-2">
          {isBoss && (
            <div className="inline-flex items-center gap-1.5 bg-boss text-white px-2 py-0.5 rounded text-xs font-bold font-display uppercase tracking-wider mb-2 animate-pulse shadow-sm">
              ⚡ Điểm nhân x2
            </div>
          )}
          <h3 className="text-lg font-bold text-neutral-900 font-display leading-snug">
            {q.prompt}
          </h3>
        </div>

        {/* Individual Question Type Renderer Slot */}
        <div className="mt-4 flex-1">
          {q.type === "mcq" && (
            <McqRenderer
              question={q}
              localAnswer={localAnswer}
              setLocalAnswer={setLocalAnswer}
              disabled={isReadOnly}
            />
          )}
          {q.type === "selectwrong" && (
            <SelectWrongRenderer
              question={q}
              localAnswer={localAnswer}
              setLocalAnswer={setLocalAnswer}
              disabled={isReadOnly}
            />
          )}
          {q.type === "truefalse" && (
            <TrueFalseRenderer
              question={q}
              localAnswer={localAnswer}
              setLocalAnswer={setLocalAnswer}
              disabled={isReadOnly}
            />
          )}
          {q.type === "dragdrop" && (
            <DragDropRenderer
              question={q}
              localAnswer={localAnswer}
              setLocalAnswer={setLocalAnswer}
              disabled={isReadOnly}
            />
          )}
          {q.type === "matching" && (
            <MatchingRenderer
              question={q}
              localAnswer={localAnswer}
              setLocalAnswer={setLocalAnswer}
              disabled={isReadOnly}
            />
          )}
        </div>
      </div>

      {/* Bottom submit control panel */}
      <div className="w-full pb-4 pt-6">
        {answerState === "submitting" || answerState === "submitted" ? (
          <div className="flex flex-col items-center gap-1.5 bg-primary-600 text-white py-3 px-6 rounded-lg text-center font-semibold text-base shadow-md">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>ĐÃ GỬI — ĐANG CHỜ CẢ LỚP...</span>
          </div>
        ) : isLocked ? (
          <div className="bg-neutral-800 text-white py-3.5 px-6 rounded-lg text-center font-bold text-base shadow-md">
            🔒 ĐÃ KHÓA ĐÁP ÁN — ĐANG ĐỢI MC
          </div>
        ) : waitingToStart ? (
          <div className="bg-primary-100 text-primary-700 border border-primary-200 py-3.5 px-6 rounded-lg text-center font-bold text-base shadow-sm flex items-center justify-center gap-2">
            <span className="animate-pulse">⏳</span>
            Chờ MC cho phép trả lời…
          </div>
        ) : (
          <Button
            onClick={handleSubmit}
            variant={isAnswerComplete() ? (isBoss ? "boss" : "primary") : "secondary"}
            size="xl"
            disabled={!isAnswerComplete() || isReadOnly}
          >
            <Send size={18} className="mr-2" />
            {isBoss ? "⚓ NEO ĐÁP ÁN BOSS" : "⚓ GỬI ĐÁP ÁN"}
          </Button>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 1. MCQ Renderer Component
// ==========================================
interface RendererProps {
  question: PublicQuestion;
  localAnswer: any;
  setLocalAnswer: (ans: any) => void;
  disabled: boolean;
}

const McqRenderer: React.FC<RendererProps> = ({ question, localAnswer, setLocalAnswer, disabled }) => {
  const selectedOptionId = localAnswer?.optionId || null;

  const handleSelect = (optionId: string) => {
    if (disabled) return;
    setLocalAnswer({ type: "mcq", optionId });
  };

  return (
    <div className="flex flex-col gap-3">
      {question.options?.map((opt) => {
        const isSelected = selectedOptionId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt.id)}
            disabled={disabled}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all active:scale-98 select-none flex items-start gap-3 ${
              isSelected
                ? "bg-primary-100/50 border-primary-600 text-primary-900 font-bold"
                : "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50"
            }`}
          >
            <span className={`h-6 w-6 rounded-full border-2 flex items-center justify-center font-mono font-bold text-sm flex-shrink-0 ${
              isSelected ? "bg-primary-600 border-primary-600 text-white" : "border-neutral-400 text-neutral-500"
            }`}>
              {opt.id}
            </span>
            <span className="text-base font-semibold leading-snug">{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
};

// ==========================================
// 2. Select Wrong Renderer Component
// ==========================================
const SelectWrongRenderer: React.FC<RendererProps> = ({ question, localAnswer, setLocalAnswer, disabled }) => {
  const selectedOptionId = localAnswer?.optionId || null;

  const handleSelect = (optionId: string) => {
    if (disabled) return;
    setLocalAnswer({ type: "selectwrong", optionId });
  };

  return (
    <div className="flex flex-col gap-3">
      {question.options?.map((opt) => {
        const isSelected = selectedOptionId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt.id)}
            disabled={disabled}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all active:scale-98 select-none flex items-start gap-3 ${
              isSelected
                ? "bg-danger-bg border-danger text-danger font-bold"
                : "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50"
            }`}
          >
            <span className={`h-6 w-6 rounded-full border-2 flex items-center justify-center font-mono font-bold text-sm flex-shrink-0 ${
              isSelected ? "bg-danger border-danger text-white" : "border-neutral-400 text-neutral-500"
            }`}>
              {opt.id}
            </span>
            <span className="text-base font-semibold leading-snug">{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
};

// ==========================================
// 3. True/False Renderer Component
// ==========================================
const TrueFalseRenderer: React.FC<RendererProps> = ({ question, localAnswer, setLocalAnswer, disabled }) => {
  const answers = localAnswer?.answers || {};

  const handleToggle = (statementId: string, value: boolean) => {
    if (disabled) return;
    setLocalAnswer({
      type: "truefalse",
      answers: {
        ...answers,
        [statementId]: value,
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {question.statements?.map((stmt, idx) => {
        const value = answers[stmt.id];
        const isTrue = value === true;
        const isFalse = value === false;

        return (
          <div key={stmt.id} className="bg-white p-4 rounded-xl border border-neutral-300 shadow-sm flex flex-col gap-3">
            <span className="text-base font-semibold text-neutral-800 leading-snug">
              {idx + 1}. {stmt.text}
            </span>
            
            <div className="flex gap-4 w-full">
              <button
                type="button"
                onClick={() => handleToggle(stmt.id, true)}
                disabled={disabled}
                className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-center transition-all select-none active:scale-97 text-base ${
                  isTrue
                    ? "bg-success-bg border-success text-success"
                    : "bg-neutral-50 border-neutral-300 text-neutral-500 hover:bg-neutral-100"
                }`}
              >
                ĐÚNG
              </button>
              <button
                type="button"
                onClick={() => handleToggle(stmt.id, false)}
                disabled={disabled}
                className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-center transition-all select-none active:scale-97 text-base ${
                  isFalse
                    ? "bg-danger-bg border-danger text-danger"
                    : "bg-neutral-50 border-neutral-300 text-neutral-500 hover:bg-neutral-100"
                }`}
              >
                SAI
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 4. Drag & Drop Renderer Component (Mobile Tap-to-Place)
// ==========================================
const DragDropRenderer: React.FC<RendererProps> = ({ question, localAnswer, setLocalAnswer, disabled }) => {
  const placement = localAnswer?.placement || {};
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);

  const handleSelectItem = (itemId: string) => {
    if (disabled) return;
    setSelectedItemId(selectedItemId === itemId ? null : itemId);
  };

  const handlePlaceInBucket = (bucketId: string) => {
    if (disabled || !selectedItemId) return;
    
    setLocalAnswer({
      type: "dragdrop",
      placement: {
        ...placement,
        [selectedItemId]: bucketId,
      },
    });
    setSelectedItemId(null); // clear selection
  };

  const handleRemoveItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    
    const newPlacement = { ...placement };
    delete newPlacement[itemId];
    setLocalAnswer({
      type: "dragdrop",
      placement: newPlacement,
    });
  };

  const unplacedItems = question.items?.filter(item => !placement[item.id]) || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-primary-100 text-primary-700 px-4 py-2.5 rounded-lg border border-primary-200 flex items-center gap-2 text-sm font-semibold">
        <HelpCircle size={18} className="flex-shrink-0" />
        <span>Chạm chọn thẻ ở khay, rồi chạm nhóm cần xếp.</span>
      </div>

      {/* Buckets grid */}
      <div className="grid grid-cols-2 gap-3">
        {question.buckets?.map((bucket) => {
          const placedInThisBucket = question.items?.filter(item => placement[item.id] === bucket.id) || [];
          const isTarget = selectedItemId !== null;

          return (
            <div
              key={bucket.id}
              onClick={() => handlePlaceInBucket(bucket.id)}
              className={`p-3 rounded-xl border-2 bg-white flex flex-col gap-2 min-h-[100px] transition-all cursor-pointer ${
                isTarget
                  ? "border-primary-600 bg-primary-100/10 shadow-md scale-[1.01]"
                  : "border-neutral-300"
              }`}
            >
              <span className="text-sm font-bold text-primary-900 border-b border-neutral-200 pb-1.5 flex items-center gap-1.5">
                <Layers size={14} />
                {bucket.name}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {placedInThisBucket.map(item => (
                  <span
                    key={item.id}
                    onClick={(e) => handleRemoveItem(item.id, e)}
                    className="inline-flex items-center gap-1 bg-primary-100 text-primary-800 text-[13px] font-semibold px-2 py-1 rounded border border-primary-200 shadow-sm"
                  >
                    {item.text}
                    {!disabled && <span className="text-[10px] opacity-60 ml-0.5 font-extrabold hover:text-danger">×</span>}
                  </span>
                ))}
                {placedInThisBucket.length === 0 && (
                  <span className="text-xs text-neutral-400 italic py-2">Trống</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unplaced tray */}
      {!disabled && unplacedItems.length > 0 && (
        <div className="bg-neutral-100 p-4 rounded-xl border border-neutral-300 mt-2 flex flex-col gap-2">
          <span className="text-sm font-bold text-neutral-700">Khay thẻ chưa xếp ({unplacedItems.length}):</span>
          <div className="flex flex-wrap gap-2">
            {unplacedItems.map(item => {
              const isSelected = selectedItemId === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleSelectItem(item.id)}
                  className={`px-3 py-2 rounded-lg border-2 text-[14px] font-semibold transition-all select-none active:scale-97 text-left shadow-sm ${
                    isSelected
                      ? "bg-accent-300 border-accent-600 text-neutral-900 scale-105 font-bold"
                      : "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50"
                  }`}
                >
                  {item.text}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. Matching Renderer Component (Left Column -> Right Column matching)
// ==========================================
const MatchingRenderer: React.FC<RendererProps> = ({ question, localAnswer, setLocalAnswer, disabled }) => {
  const placement = localAnswer?.placement || {};
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);

  const handleLeftTap = (itemId: string) => {
    if (disabled) return;
    setSelectedItemId(selectedItemId === itemId ? null : itemId);
  };

  const handleRightTap = (bucketId: string) => {
    if (disabled || !selectedItemId) return;

    setLocalAnswer({
      type: "matching",
      placement: {
        ...placement,
        [selectedItemId]: bucketId,
      },
    });
    setSelectedItemId(null); // clear selection
  };

  const handleRemoveLink = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    
    const newPlacement = { ...placement };
    delete newPlacement[itemId];
    setLocalAnswer({
      type: "matching",
      placement: newPlacement,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-primary-100 text-primary-700 px-4 py-2.5 rounded-lg border border-primary-200 flex items-center gap-2 text-sm font-semibold">
        <CheckSquare size={18} className="flex-shrink-0" />
        <span>Chạm cột trái, rồi chạm cột phải tương ứng để nối.</span>
      </div>

      <div className="flex gap-4">
        {/* Left Column - Items */}
        <div className="flex-1 flex flex-col gap-3">
          <span className="text-sm font-bold text-neutral-700 border-b pb-1.5 text-center">Khái niệm</span>
          {question.items?.map(item => {
            const isSelected = selectedItemId === item.id;
            const matchedBucketId = placement[item.id];
            const matchedBucketName = question.buckets?.find(b => b.id === matchedBucketId)?.name;

            return (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => handleLeftTap(item.id)}
                  disabled={disabled}
                  className={`w-full p-3 rounded-lg border-2 text-[14px] font-semibold transition-all select-none text-left shadow-sm ${
                    isSelected
                      ? "bg-accent-300 border-accent-600 text-neutral-900 font-bold scale-[1.02]"
                      : matchedBucketId
                      ? "bg-primary-100/50 border-primary-500 text-primary-900"
                      : "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50"
                  }`}
                >
                  <span className="block leading-snug">{item.text}</span>
                  {matchedBucketId && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-700 bg-white border border-primary-300 px-1.5 py-0.5 rounded mt-1.5">
                      → {matchedBucketName}
                      {!disabled && (
                        <span
                          onClick={(e) => handleRemoveLink(item.id, e)}
                          className="inline-flex items-center justify-center text-base leading-none text-danger font-extrabold cursor-pointer ml-0.5 -my-1 px-2 py-1"
                        >
                          ×
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Column - Buckets */}
        <div className="flex-1 flex flex-col gap-3">
          <span className="text-sm font-bold text-neutral-700 border-b pb-1.5 text-center">Định nghĩa</span>
          {question.buckets?.map(bucket => {
            const isTarget = selectedItemId !== null;

            return (
              <button
                key={bucket.id}
                type="button"
                onClick={() => handleRightTap(bucket.id)}
                disabled={disabled || !isTarget}
                className={`w-full p-3 rounded-lg border-2 text-[14px] font-semibold transition-all select-none text-left shadow-sm min-h-[64px] flex items-center justify-between ${
                  isTarget
                    ? "bg-white border-primary-600 text-primary-700 animate-pulse scale-[1.02]"
                    : "bg-neutral-50 border-neutral-300 text-neutral-700"
                }`}
              >
                <span className="leading-snug">{bucket.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
