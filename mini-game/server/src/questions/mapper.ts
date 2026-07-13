import { QuestionFull } from "../types/question";
import { PublicQuestion, StationId } from "../shared/socket/events";
import { mapStationId } from "./loader";

// Build a human-readable correct-answer string for the MC-only preview panel.
// Answers are NEVER shipped to the client bundle; they are sent over a host-only
// socket event (see emitHostQuestionInfo) so students cannot read them from the JS.
export function buildAnswerText(q: QuestionFull): string {
  switch (q.type) {
    case "mcq": {
      const o = q.options?.find(x => x.id === q.correct);
      return `Đáp án đúng: ${q.correct}. ${o?.text ?? ""}`;
    }
    case "selectwrong": {
      const o = q.options?.find(x => x.id === q.correct);
      return `Phương án SAI cần chọn: ${q.correct}. ${o?.text ?? ""}`;
    }
    case "truefalse":
      return (q.statements ?? [])
        .map((s, i) => `${i + 1}. ${s.isTrue ? "ĐÚNG" : "SAI"} — ${s.text}`)
        .join("\n");
    case "dragdrop":
    case "matching":
      return (q.items ?? [])
        .map(it => {
          const b = q.buckets?.find(x => x.id === it.correctBucket);
          return `• ${it.text}  →  ${b?.name ?? it.correctBucket}`;
        })
        .join("\n");
    default:
      return "";
  }
}

export function toPublicQuestion(q: QuestionFull): PublicQuestion {
  const stationId = mapStationId(q.station);
  
  const publicQ: PublicQuestion = {
    questionId: q.id,
    station: stationId,
    stationName: q.stationName,
    type: q.type,
    topic: q.topic,
    learningLevel: q.learningLevel,
    difficulty: q.difficulty,
    timeLimitSec: q.timeLimitSec,
    basePoints: q.basePoints,
    prompt: q.prompt,
    pointsMultiplier: q.pointsMultiplier,
  };

  // Strip answers based on question type
  if (q.options) {
    publicQ.options = q.options.map(opt => ({ id: opt.id, text: opt.text }));
  }

  if (q.statements) {
    publicQ.statements = q.statements.map(stmt => ({ id: stmt.id, text: stmt.text }));
  }

  if (q.buckets) {
    publicQ.buckets = q.buckets.map(b => ({ id: b.id, name: b.name }));
  }

  if (q.items) {
    publicQ.items = q.items.map(item => ({ id: item.id, text: item.text }));
  }

  return publicQ;
}

export function getBadgeForStation(station: StationId): string {
  switch (station) {
    case 1:
      return "Nhà Thông Thái";
    case 2:
      return "Thủy Thủ Vượt Sóng";
    case 3:
      return "Nhà Kinh Tế";
    case 4:
      return "Chuyên Gia Thể Chế";
    case "boss":
      return "Anh Hùng Vượt Bão";
    default:
      return "Thủy Thủ";
  }
}

export interface ClientKnowledgeCard {
  title: string;
  body: string;
  badge?: string;
  station: StationId;
}

export function toPublicKnowledgeCard(q: QuestionFull): {
  questionId: string;
  explain: string;
  knowledgeCard: ClientKnowledgeCard;
} {
  const stationId = mapStationId(q.station);
  return {
    questionId: q.id,
    explain: q.explain,
    knowledgeCard: {
      title: `Thẻ Tri Thức - ${q.stationName}`,
      body: typeof q.knowledgeCard === "string" ? q.knowledgeCard : (q.knowledgeCard as any).body || "",
      badge: getBadgeForStation(stationId),
      station: stationId,
    },
  };
}
