import { AnswerPayload, QuestionType } from "../shared/socket/events";

// Simple profanity list for Vietnamese/English bad words
const PROFANITY_LIST = [
  "dm", "dkm", "cl", "vl", "vkl", "cmn", "fuck", "bitch", "shit", "ass", "idiot"
];

export function isCleanNickname(nickname: string): boolean {
  const lower = nickname.toLowerCase();
  // Split into word tokens so short slurs ("dm", "cl", "vl", "ass") are only matched when they
  // stand alone — this stops innocent names like "Class", "Cass" or "Cường" from being blocked.
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  // For longer profanities we still catch them anywhere (e.g. "fuckyou").
  const stripped = lower.replace(/[^a-z]/g, "");
  for (const word of PROFANITY_LIST) {
    if (tokens.includes(word)) return false;
    if (word.length >= 4 && stripped.includes(word)) return false;
  }
  return true;
}

export function validateAnswerPayload(type: QuestionType, answer: AnswerPayload): boolean {
  if (answer.type !== type) return false;

  switch (type) {
    case "mcq":
    case "selectwrong": {
      const ans = answer as any;
      return typeof ans.optionId === "string" && ans.optionId.trim().length > 0;
    }

    case "truefalse": {
      const ans = answer as any;
      if (!ans.answers || typeof ans.answers !== "object") return false;
      for (const [key, value] of Object.entries(ans.answers)) {
        if (typeof key !== "string" || typeof value !== "boolean") return false;
      }
      return true;
    }

    case "dragdrop":
    case "matching": {
      const ans = answer as any;
      if (!ans.placement || typeof ans.placement !== "object") return false;
      for (const [key, value] of Object.entries(ans.placement)) {
        if (typeof key !== "string" || typeof value !== "string") return false;
      }
      return true;
    }

    default:
      return false;
  }
}
