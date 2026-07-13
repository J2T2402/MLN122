import { StationId, QuestionType } from "../shared/socket/events";

export interface QuestionFull {
  id: string;
  station: number; // 1 | 2 | 3 | 4 | 6 (6 is boss in questions.json)
  stationName: string;
  type: QuestionType;
  topic: string;
  learningLevel: "nho" | "hieu" | "phan_loai" | "van_dung";
  difficulty: 1 | 2 | 3;
  timeLimitSec: number;
  basePoints: number;
  prompt: string;
  pointsMultiplier?: number;

  // Options arrays depending on type
  options?: { id: string; text: string }[]; // mcq, selectwrong
  statements?: { id: string; text: string; isTrue: boolean }[]; // truefalse
  buckets?: { id: string; name: string }[]; // dragdrop, matching
  items?: { id: string; text: string; correctBucket: string }[]; // dragdrop, matching

  correct?: string; // mcq / selectwrong answer (correct option ID)
  explain: string;
  knowledgeCard: string; // Wait! Let's check questions.json: lines 68 show "knowledgeCard" is a string in questions.json!
  // Wait, let's verify if in questions.json "knowledgeCard" is a string or an object. Let's look at lines 68: "knowledgeCard": "KTTT định hướng XHCN = vận hành theo quy luật thị trường + hướng tới mục tiêu dân giàu, nước mạnh, dân chủ, công bằng, văn minh."
  // Yes, in questions.json, "knowledgeCard" is a string. But the socket event `knowledgeCard` sends an object:
  // knowledgeCard: { title: string; body: string; badge?: string; station: StationId }
  // So the QuestionFull will store the string, and the mapper will construct the object when mapping to the socket payload!
  // Let's check how be-spec.md describes it:
  // knowledgeCard: { title: string; body: string; badge?: string; station: StationId };
  // Wait, let's look at how be-spec.md defines QuestionFull. On line 348 it has:
  // knowledgeCard: { title: string; body: string; badge?: string; station: StationId };
  // Let's verify if questions.json has other properties.
  // In questions.json (line 68): "knowledgeCard": "KTTT định hướng XHCN = ..."
  // Let's check what other properties are in questions.json by checking lines 1220 to 1260 to see if there is any other structure, or let's use the string from questions.json as the body, and make the title of the card be the station name or topic, and we can also add custom badge properties.
  // Let's verify what be-spec.md says. Let's write QuestionFull so it supports both:
  // we can have knowledgeCard in questions.json loaded as a string or object.
  // Let's define the interface:
  commonMistake?: string;
}
