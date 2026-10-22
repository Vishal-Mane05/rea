import { NextResponse } from "next/server";
import { z } from "zod";
import { ownedBlock, ownedPage, touchCourseOfPage } from "@/lib/access";
import { db } from "@/lib/db";
import { notFound, parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

const schema = z.object({
  type: z.enum(["TEXT", "IMAGE", "VIDEO", "COLUMNS", "CALLOUT"]),
  parentId: z.string().uuid().optional(),
  /** insert position; defaults to the end */
  position: z.number().int().min(0).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const page = await ownedPage((await params).id, user.id);
  if (!page) return notFound();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const { type, parentId } = body.data;
  if (parentId) {
    const parent = await ownedBlock(parentId, user.id);
    if (!parent || parent.pageId !== page.id || parent.type !== "COLUMNS") return notFound();
  }
  const siblings = { pageId: page.id, parentId: parentId ?? null };
  const count = await db.block.count({ where: siblings });
  const position = Math.min(body.data.position ?? count, count);

  const block = await db.$transaction(async (tx) => {
    await tx.block.updateMany({ where: { ...siblings, position: { gte: position } }, data: { position: { increment: 1 } } });
    return tx.block.create({
      data: {
        ...siblings,
        type,
        position,
        // a columns block starts with two text columns
        children:
          type === "COLUMNS"
            ? { create: [0, 1].map((i) => ({ pageId: page.id, type: "TEXT" as const, position: i })) }
            : undefined,
      },
      include: { children: { orderBy: { position: "asc" } } },
    });
  });
  await touchCourseOfPage(page.id);
  return NextResponse.json(block, { status: 201 });
}
