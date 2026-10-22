import { z } from "zod";
import { ownedBlock, touchCourseOfPage } from "@/lib/access";
import { db } from "@/lib/db";
import { noContent, notFound, parseBody } from "@/lib/http";
import { isMediaOrHttpUrl } from "@/lib/media";
import { currentUser } from "@/lib/user";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  html: z.string().max(200_000).optional(),
  url: z.string().max(2000).refine(isMediaOrHttpUrl, "must be an http(s) URL or an uploaded media path").nullable().optional(),
  caption: z.string().max(1000).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await currentUser();
  const block = await ownedBlock((await params).id, user.id);
  if (!block) return notFound();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  await db.block.update({ where: { id: block.id }, data: body.data });
  await touchCourseOfPage(block.pageId);
  return noContent();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  const block = await ownedBlock((await params).id, user.id);
  if (!block) return notFound();
  await db.$transaction([
    db.block.delete({ where: { id: block.id } }),
    db.block.updateMany({
      where: { pageId: block.pageId, parentId: block.parentId, position: { gt: block.position } },
      data: { position: { decrement: 1 } },
    }),
  ]);
  await touchCourseOfPage(block.pageId);
  return noContent();
}
