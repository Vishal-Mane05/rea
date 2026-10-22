import { NextResponse } from "next/server";
import { z } from "zod";
import { ownedCourse } from "@/lib/access";
import { db } from "@/lib/db";
import { notFound, parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

const schema = z.object({ title: z.string().max(200).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const course = await ownedCourse((await params).id, user.id);
  if (!course) return notFound();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const position = await db.section.count({ where: { courseId: course.id } });
  const section = await db.section.create({
    data: {
      courseId: course.id,
      title: body.data.title || "Untitled section",
      position,
      pages: { create: [{ type: "CONTENT", title: "Untitled page", position: 0, blocks: { create: [{ type: "TEXT", position: 0 }] } }] },
    },
    include: { pages: { include: { blocks: { include: { children: true } }, answers: true } } },
  });
  await db.course.update({ where: { id: course.id }, data: { updatedAt: new Date() } });
  return NextResponse.json(section, { status: 201 });
}
