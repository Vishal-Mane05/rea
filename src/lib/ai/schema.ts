import { z } from "zod";
import type { PageType } from "@prisma/client";
import { sanitizeHtml } from "./sanitize";

// Shapes Claude must return. Kept constraint-free (no min/max) so they translate
// cleanly to structured-output JSON schema; invariants are enforced in normalize*.

const answerSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
  explanation: z.string().describe("One sentence on why this option is right or wrong"),
});

export const aiPageSchema = z.object({
  type: z.enum(["CONTENT", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "OPEN_QUESTION"]),
  title: z.string().describe("Page title, or for questions the full question text"),
  html: z.string().describe("CONTENT: the page body. Questions: optional short scenario/context, else empty string"),
  answers: z.array(answerSchema).describe("Empty for CONTENT and OPEN_QUESTION"),
  correctFeedback: z.string(),
  incorrectFeedback: z.string(),
});

export const courseOutlineSchema = z.object({
  title: z.string(),
  description: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      learningObjective: z.string(),
      pages: z.array(aiPageSchema),
    }),
  ),
});

export const quizSchema = z.object({ questions: z.array(aiPageSchema) });

export const rewriteSchema = z.object({ html: z.string() });

export type AiPage = z.infer<typeof aiPageSchema>;
export type CourseOutline = z.infer<typeof courseOutlineSchema>;

export interface NormalizedPage {
  type: PageType;
  title: string;
  html: string;
  answers: { text: string; isCorrect: boolean; explanation: string }[];
  correctFeedback: string;
  incorrectFeedback: string;
}

const clip = (s: string, n: number) => s.trim().slice(0, n);

/** Enforce per-type answer rules; returns null for a question that can't be repaired. */
export function normalizePage(p: AiPage): NormalizedPage | null {
  const base = {
    title: clip(p.title, 500) || (p.type === "CONTENT" ? "Untitled page" : "Untitled question"),
    html: sanitizeHtml(p.html).slice(0, 200_000),
    correctFeedback: clip(p.correctFeedback, 5000),
    incorrectFeedback: clip(p.incorrectFeedback, 5000),
  };
  const answers = p.answers
    .map((a) => ({ text: clip(a.text, 1000), isCorrect: a.isCorrect, explanation: clip(a.explanation, 5000) }))
    .filter((a) => a.text);

  switch (p.type) {
    case "CONTENT":
      return { ...base, type: "CONTENT", answers: [], correctFeedback: "", incorrectFeedback: "" };
    case "OPEN_QUESTION":
      return { ...base, type: "OPEN_QUESTION", answers: [] };
    case "TRUE_FALSE": {
      // whatever the model wrote, the options are exactly True / False
      const marked = answers.find((a) => a.isCorrect);
      const falseIsCorrect = marked ? /^(false|no|incorrect|wrong|onwaar|falsch|faux|falso)\b/i.test(marked.text) : false;
      const explain = (correct: boolean) => answers.find((a) => a.isCorrect === correct)?.explanation ?? "";
      return {
        ...base,
        type: "TRUE_FALSE",
        answers: [
          { text: "True", isCorrect: !falseIsCorrect, explanation: explain(!falseIsCorrect) },
          { text: "False", isCorrect: falseIsCorrect, explanation: explain(falseIsCorrect) },
        ],
      };
    }
    case "SINGLE_CHOICE": {
      const opts = answers.slice(0, 8);
      if (opts.length < 2) return null;
      const first = Math.max(0, opts.findIndex((a) => a.isCorrect));
      return { ...base, type: "SINGLE_CHOICE", answers: opts.map((a, i) => ({ ...a, isCorrect: i === first })) };
    }
    case "MULTIPLE_CHOICE": {
      const opts = answers.slice(0, 8);
      if (opts.length < 2) return null;
      if (!opts.some((a) => a.isCorrect)) opts[0].isCorrect = true;
      return { ...base, type: "MULTIPLE_CHOICE", answers: opts };
    }
  }
}
