import { z } from "zod";
import { ownedAnswer, touchCourseOfPage } from "@/lib/access";
import { db } from "@/lib/db";
import { noContent, notFound, parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  text: z.string().max(1000).optional(),
  isCorrect: z.boolean().optional(),
  explanation: z.string().max(5000).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await currentUser();
  const answer = await ownedAnswer((await params).id, user.id);
  if (!answer) return notFound();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const page = await db.page.findUniqueOrThrow({ where: { id: answer.pageId } });
  // single-answer questions keep exactly one correct option
  const exclusive = body.data.isCorrect === true && (page.type === "SINGLE_CHOICE" || page.type === "TRUE_FALSE");
  await db.$transaction([
    ...(exclusive
      ? [db.answer.updateMany({ where: { pageId: page.id, id: { not: answer.id } }, data: { isCorrect: false } })]
      : []),
    db.answer.update({ where: { id: answer.id }, data: body.data }),
  ]);
  await touchCourseOfPage(page.id);
  return noContent();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  const answer = await ownedAnswer((await params).id, user.id);
  if (!answer) return notFound();
  await db.answer.delete({ where: { id: answer.id } });
  await touchCourseOfPage(answer.pageId);
  return noContent();
}
