import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/http";
import { createCourseFromTemplate } from "@/lib/templates";
import { currentUser } from "@/lib/user";

export async function GET() {
  const user = await currentUser();
  const courses = await db.course.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      templateKey: true,
      updatedAt: true,
      publishedAt: true,
      _count: { select: { sections: true } },
    },
  });
  return NextResponse.json(courses);
}

const createSchema = z.object({ templateKey: z.string().default("blank"), title: z.string().max(200).optional() });

export async function POST(req: Request) {
  const user = await currentUser();
  const body = await parseBody(req, createSchema);
  if (body.error) return body.error;
  const course = await createCourseFromTemplate(user.id, body.data.templateKey, body.data.title);
  return NextResponse.json({ id: course.id }, { status: 201 });
}
