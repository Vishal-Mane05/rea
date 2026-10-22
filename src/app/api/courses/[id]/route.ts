import { NextResponse } from "next/server";
import { z } from "zod";
import { ownedCourse } from "@/lib/access";
import { loadCourseTree, readSettings } from "@/lib/course";
import { db } from "@/lib/db";
import { noContent, notFound, parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  const course = await loadCourseTree((await params).id, user.id);
  return course ? NextResponse.json(course) : notFound();
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  language: z.string().min(2).max(10).optional(),
  settings: z
    .object({
      layout: z.enum(["onePage", "pageByPage"]),
      passingScore: z.number().int().min(0).max(100),
      showFeedback: z.boolean(),
      allowRetry: z.boolean(),
      showProgress: z.boolean(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
    .partial()
    .optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await currentUser();
  const course = await ownedCourse((await params).id, user.id);
  if (!course) return notFound();
  const body = await parseBody(req, patchSchema);
  if (body.error) return body.error;
  const { settings, ...rest } = body.data;
  await db.course.update({
    where: { id: course.id },
    data: { ...rest, ...(settings && { settings: { ...readSettings(course.settings), ...settings } }) },
  });
  return noContent();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  const course = await ownedCourse((await params).id, user.id);
  if (!course) return notFound();
  await db.course.delete({ where: { id: course.id } });
  return noContent();
}
