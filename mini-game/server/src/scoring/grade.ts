import { QuestionFull } from "../types/question";
import { AnswerPayload } from "../shared/socket/events";

export interface GradeResult {
  isCorrect: boolean;
  correctRatio: number; // 0..1
}

export function gradeAnswer(q: QuestionFull, answer: AnswerPayload): GradeResult {
  // If answer type doesn't match question type, it's incorrect
  if (answer.type !== q.type) {
    return { isCorrect: false, correctRatio: 0 };
  }

  switch (q.type) {
    case "mcq":
    case "selectwrong": {
      const ans = answer as { type: "mcq" | "selectwrong"; optionId: string };
      const isCorrect = ans.optionId === q.correct;
      return {
        isCorrect,
        correctRatio: isCorrect ? 1 : 0
      };
    }

    case "truefalse": {
      const ans = answer as { type: "truefalse"; answers: Record<string, boolean> };
      if (!q.statements || q.statements.length === 0) {
        return { isCorrect: false, correctRatio: 0 };
      }
      
      let matches = 0;
      for (const stmt of q.statements) {
        const playerVal = ans.answers[stmt.id];
        const correctVal = stmt.isTrue;
        if (playerVal === correctVal) {
          matches++;
        }
      }
      
      const ratio = matches / q.statements.length;
      return {
        isCorrect: ratio === 1,
        correctRatio: ratio
      };
    }

    case "dragdrop":
    case "matching": {
      const ans = answer as { type: "dragdrop" | "matching"; placement: Record<string, string> };
      if (!q.items || q.items.length === 0) {
        return { isCorrect: false, correctRatio: 0 };
      }
      
      let matches = 0;
      for (const item of q.items) {
        const playerVal = ans.placement[item.id];
        const correctVal = item.correctBucket;
        if (playerVal === correctVal) {
          matches++;
        }
      }
      
      const ratio = matches / q.items.length;
      return {
        isCorrect: ratio === 1,
        correctRatio: ratio
      };
    }

    default:
      return { isCorrect: false, correctRatio: 0 };
  }
}
