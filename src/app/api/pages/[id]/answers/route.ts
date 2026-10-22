import { NextResponse } from "next/server";
import { z } from "zod";
import { ownedPage, touchCourseOfPage } from "@/lib/access";
import { db } from "@/lib/db";
import { notFound, parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

const schema = z.object({ text: z.string().max(1000).optional(), isCorrect: z.boolean().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const page = await ownedPage((await params).id, user.id);
  if (!page) return notFound();
  if (page.type === "CONTENT" || page.type === "OPEN_QUESTION" || page.type === "TRUE_FALSE") {
    return NextResponse.json({ error: "page_type_has_fixed_answers" }, { status: 400 });
  }
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const position = await db.answer.count({ where: { pageId: page.id } });
  const answer = await db.answer.create({
    data: { pageId: page.id, text: body.data.text ?? "New answer", isCorrect: body.data.isCorrect ?? false, position },
  });
  await touchCourseOfPage(page.id);
  return NextResponse.json(answer, { status: 201 });
}
