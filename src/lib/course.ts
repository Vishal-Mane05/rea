import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { defaultSettings, type CoursePackage, type CourseSettings, type PackageBlock } from "../../../player/src/format";

const byPosition = { orderBy: { position: "asc" as const } };

export const courseTreeInclude = {
  sections: {
    ...byPosition,
    include: {
      pages: {
        ...byPosition,
        include: {
          blocks: { ...byPosition, where: { parentId: null }, include: { children: byPosition } },
          answers: byPosition,
        },
      },
    },
  },
} satisfies Prisma.CourseInclude;

export type CourseTree = Prisma.CourseGetPayload<{ include: typeof courseTreeInclude }>;

export function loadCourseTree(id: string, ownerId: string) {
  return db.course.findFirst({ where: { id, ownerId }, include: courseTreeInclude });
}

export function readSettings(value: Prisma.JsonValue): CourseSettings {
  return { ...defaultSettings, ...(value && typeof value === "object" && !Array.isArray(value) ? value : {}) };
}

type BlockRow = CourseTree["sections"][number]["pages"][number]["blocks"][number];

function toPackageBlock(b: Omit<BlockRow, "children"> & { children?: BlockRow["children"] }): PackageBlock {
  return {
    id: b.id,
    type: b.type,
    html: b.html,
    url: b.url,
    caption: b.caption,
    children: (b.children ?? []).map((c) => toPackageBlock(c)),
  };
}

export function toPackage(course: CourseTree): CoursePackage {
  return {
    formatVersion: 1,
    id: course.id,
    title: course.title,
    description: course.description,
    language: course.language,
    settings: readSettings(course.settings),
    sections: course.sections.map((s) => ({
      id: s.id,
      title: s.title,
      learningObjective: s.learningObjective,
      imageUrl: s.imageUrl,
      pages: s.pages.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        isScored: p.isScored,
        isSurvey: p.isSurvey,
        correctFeedback: p.correctFeedback,
        incorrectFeedback: p.incorrectFeedback,
        blocks: p.blocks.map(toPackageBlock),
        answers: p.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect, explanation: a.explanation })),
      })),
    })),
  };
}
