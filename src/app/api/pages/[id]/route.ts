import { z } from "zod";
import { ownedPage, touchCourseOfPage } from "@/lib/access";
import { db } from "@/lib/db";
import { noContent, notFound, parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().max(500).optional(),
  isScored: z.boolean().optional(),
  isSurvey: z.boolean().optional(),
  correctFeedback: z.string().max(5000).optional(),
  incorrectFeedback: z.string().max(5000).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await currentUser();
  const page = await ownedPage((await params).id, user.id);
  if (!page) return notFound();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  await db.page.update({ where: { id: page.id }, data: body.data });
  await touchCourseOfPage(page.id);
  return noContent();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  const page = await ownedPage((await params).id, user.id);
  if (!page) return notFound();
  await touchCourseOfPage(page.id);
  await db.page.delete({ where: { id: page.id } });
  return noContent();
}
