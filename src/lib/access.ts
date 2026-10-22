import { db } from "./db";

// Each lookup only succeeds when the entity belongs to a course owned by `ownerId`.

export const ownedCourse = (id: string, ownerId: string) => db.course.findFirst({ where: { id, ownerId } });

export const ownedSection = (id: string, ownerId: string) =>
  db.section.findFirst({ where: { id, course: { ownerId } } });

export const ownedPage = (id: string, ownerId: string) =>
  db.page.findFirst({ where: { id, section: { course: { ownerId } } } });

export const ownedBlock = (id: string, ownerId: string) =>
  db.block.findFirst({ where: { id, page: { section: { course: { ownerId } } } } });

export const ownedAnswer = (id: string, ownerId: string) =>
  db.answer.findFirst({ where: { id, page: { section: { course: { ownerId } } } } });

/** Touch the course so dashboards sort by last edit. */
export async function touchCourseOfSection(sectionId: string) {
  const s = await db.section.findUnique({ where: { id: sectionId }, select: { courseId: true } });
  if (s) await db.course.update({ where: { id: s.courseId }, data: { updatedAt: new Date() } });
}

export async function touchCourseOfPage(pageId: string) {
  const p = await db.page.findUnique({ where: { id: pageId }, select: { sectionId: true } });
  if (p) await touchCourseOfSection(p.sectionId);
}
