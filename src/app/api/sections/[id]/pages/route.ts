import { NextResponse } from "next/server";
import { z } from "zod";
import { ownedSection, touchCourseOfSection } from "@/lib/access";
import { db } from "@/lib/db";
import { notFound, parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

const schema = z.object({
  type: z.enum(["CONTENT", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "OPEN_QUESTION"]).default("CONTENT"),
  title: z.string().max(500).optional(),
});

const starterAnswers = {
  CONTENT: [],
  OPEN_QUESTION: [],
  TRUE_FALSE: [
    { text: "True", isCorrect: true },
    { text: "False", isCorrect: false },
  ],
  SINGLE_CHOICE: [
    { text: "Correct answer", isCorrect: true },
    { text: "Wrong answer", isCorrect: false },
  ],
  MULTIPLE_CHOICE: [
    { text: "Correct answer", isCorrect: true },
    { text: "Another correct answer", isCorrect: true },
    { text: "Wrong answer", isCorrect: false },
  ],
} as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const section = await ownedSection((await params).id, user.id);
  if (!section) return notFound();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const { type } = body.data;
  const position = await db.page.count({ where: { sectionId: section.id } });
  const page = await db.page.create({
    data: {
      sectionId: section.id,
      type,
      title: body.data.title || (type === "CONTENT" ? "Untitled page" : "Untitled question"),
      position,
      blocks: type === "CONTENT" ? { create: [{ type: "TEXT", position: 0 }] } : undefined,
      answers: { create: starterAnswers[type].map((a, i) => ({ ...a, position: i })) },
    },
    include: { blocks: { include: { children: true } }, answers: { orderBy: { position: "asc" } } },
  });
  await touchCourseOfSection(section.id);
  return NextResponse.json(page, { status: 201 });
}
