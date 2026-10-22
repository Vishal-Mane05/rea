import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { defaultSettings } from "../../../../player/src/format";
import { normalizePage, type CourseOutline, type NormalizedPage } from "./schema";

function pageCreate(p: NormalizedPage, position: number) {
  return {
    type: p.type,
    title: p.title,
    position,
    correctFeedback: p.correctFeedback,
    incorrectFeedback: p.incorrectFeedback,
    // content pages always get a text block; questions only when there's context text
    blocks: p.type === "CONTENT" || p.html ? { create: [{ type: "TEXT" as const, position: 0, html: p.html }] } : undefined,
    answers: p.answers.length ? { create: p.answers.map((a, i) => ({ ...a, position: i })) } : undefined,
  } satisfies Prisma.PageCreateWithoutSectionInput;
}

/** Create a whole course from a validated AI outline in one write. */
export async function createCourseFromOutline(ownerId: string, outline: CourseOutline, language: string) {
  const sections = outline.sections
    .map((s) => ({
      title: s.title.trim().slice(0, 200) || "Untitled section",
      learningObjective: s.learningObjective.trim().slice(0, 1000),
      pages: s.pages.map(normalizePage).filter((p): p is NormalizedPage => p !== null),
    }))
    .filter((s) => s.pages.length > 0);
  if (sections.length === 0) return null;

  return db.course.create({
    data: {
      ownerId,
      title: outline.title.trim().slice(0, 200) || "Untitled course",
      description: outline.description.trim().slice(0, 5000),
      language: language.slice(0, 10),
      templateKey: "ai",
      settings: { ...defaultSettings },
      sections: {
        create: sections.map((s, si) => ({
          title: s.title,
          learningObjective: s.learningObjective,
          position: si,
          pages: { create: s.pages.map(pageCreate) },
        })),
      },
    },
    select: { id: true },
  });
}

/** Append question pages to the end of a section; returns them in editor shape. */
export async function appendPages(sectionId: string, pages: NormalizedPage[]) {
  return db.$transaction(async (tx) => {
    const start = await tx.page.count({ where: { sectionId } });
    const created = [];
    for (const [i, p] of pages.entries()) {
      created.push(
        await tx.page.create({
          data: { sectionId, ...pageCreate(p, start + i) },
          include: {
            blocks: { where: { parentId: null }, orderBy: { position: "asc" }, include: { children: { orderBy: { position: "asc" } } } },
            answers: { orderBy: { position: "asc" } },
          },
        }),
      );
    }
    return created;
  }, { timeout: 20_000 });
}
