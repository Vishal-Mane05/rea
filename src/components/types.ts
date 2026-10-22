// JSON shapes returned by the API, as seen by the browser.
import type { BlockType, CourseSettings, PageType } from "../../../player/src/format";

export type { BlockType, CourseSettings, PageType };

export interface Block {
  id: string;
  pageId: string;
  parentId: string | null;
  type: BlockType;
  position: number;
  html: string;
  url: string | null;
  caption: string;
  children?: Block[];
}

export interface Answer {
  id: string;
  pageId: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
  position: number;
}

export interface Page {
  id: string;
  sectionId: string;
  type: PageType;
  title: string;
  position: number;
  isScored: boolean;
  isSurvey: boolean;
  correctFeedback: string;
  incorrectFeedback: string;
  blocks: Block[];
  answers: Answer[];
}

export interface Section {
  id: string;
  courseId: string;
  title: string;
  learningObjective: string;
  imageUrl: string | null;
  position: number;
  pages: Page[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  language: string;
  templateKey: string;
  settings: Partial<CourseSettings>;
  publishedAt: string | null;
  updatedAt: string;
  sections: Section[];
}

export interface CourseSummary {
  id: string;
  title: string;
  templateKey: string;
  updatedAt: string;
  publishedAt: string | null;
  _count: { sections: number };
}

export interface TemplateSummary {
  key: string;
  name: string;
  description: string;
  emoji: string;
  sectionCount: number;
  pageCount: number;
}

export const pageTypeLabels: Record<PageType, string> = {
  CONTENT: "Content page",
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  TRUE_FALSE: "True / false",
  OPEN_QUESTION: "Open question",
};

export const pageTypeIcons: Record<PageType, string> = {
  CONTENT: "📄",
  SINGLE_CHOICE: "◉",
  MULTIPLE_CHOICE: "☑",
  TRUE_FALSE: "⇄",
  OPEN_QUESTION: "✎",
};
