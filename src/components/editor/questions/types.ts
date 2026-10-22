import type { PageType, QuestionDataOf, ScoringMode } from "@lf/schema";

export type QuestionType = Exclude<PageType, "content">;

/**
 * The page shape the question editors need. Structural on purpose so the editor route can pass the
 * page object it got from `api.courses.get` / `api.pages.patch` without mapping.
 */
export interface QuestionPage {
  id: string;
  type: string;
  title: string;
  hideTitle?: boolean;
  scoringMode: number;
  isGeneralFeedback: boolean;
  hasInstruction: boolean;
  voiceOverUrl?: string | null;
  data: unknown;
  sectionId?: string;
  courseId?: string;
}

export interface QuestionPagePatch {
  title?: string;
  hideTitle?: boolean;
  scoringMode?: ScoringMode;
  isGeneralFeedback?: boolean;
  hasInstruction?: boolean;
  voiceOverUrl?: string | null;
  data?: unknown;
}

export interface QuestionTypeEditorProps {
  page: QuestionPage;
  onChange: (patch: QuestionPagePatch) => void;
}

/** Props used internally by each typed editor (data already parsed + defaulted). */
export interface TypedEditorProps<T extends QuestionType> {
  page: QuestionPage;
  data: QuestionDataOf<T>;
  setData: (next: QuestionDataOf<T>) => void;
  survey: boolean;
  perAnswerFeedback: boolean;
}
