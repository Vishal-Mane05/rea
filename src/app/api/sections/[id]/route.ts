import { z } from "zod";
import { ownedSection, touchCourseOfSection } from "@/lib/access";
import { db } from "@/lib/db";
import { noContent, notFound, parseBody } from "@/lib/http";
import { isMediaOrHttpUrl } from "@/lib/media";
import { currentUser } from "@/lib/user";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().max(200).optional(),
  learningObjective: z.string().max(1000).optional(),
  imageUrl: z.string().max(2000).refine(isMediaOrHttpUrl, "must be an http(s) URL or an uploaded media path").nullable().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await currentUser();
  const section = await ownedSection((await params).id, user.id);
  if (!section) return notFound();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  await db.section.update({ where: { id: section.id }, data: body.data });
  await touchCourseOfSection(section.id);
  return noContent();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  const section = await ownedSection((await params).id, user.id);
  if (!section) return notFound();
  await touchCourseOfSection(section.id);
  await db.section.delete({ where: { id: section.id } });
  return noContent();
}
