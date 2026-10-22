import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { noContent, parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

// Persist a new order for siblings. For pages, `parentId` may name a different section to move into.
const schema = z.object({
  kind: z.enum(["section", "page", "block", "answer"]),
  parentId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export async function POST(req: Request) {
  const user = await currentUser();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const { kind, parentId, ids } = body.data;
  const owner = { ownerId: user.id };

  const ok = await (async () => {
    switch (kind) {
      case "section": {
        const n = await db.section.count({ where: { id: { in: ids }, courseId: parentId, course: owner } });
        if (n !== ids.length) return false;
        await db.$transaction(ids.map((id, position) => db.section.update({ where: { id }, data: { position } })));
        return true;
      }
      case "page": {
        const target = await db.section.findFirst({ where: { id: parentId, course: owner } });
        if (!target) return false;
        const n = await db.page.count({ where: { id: { in: ids }, section: { courseId: target.courseId, course: owner } } });
        if (n !== ids.length) return false;
        await db.$transaction(
          ids.map((id, position) => db.page.update({ where: { id }, data: { position, sectionId: parentId } })),
        );
        return true;
      }
      case "block": {
        const n = await db.block.count({
          where: { id: { in: ids }, pageId: parentId, parentId: null, page: { section: { course: owner } } },
        });
        if (n !== ids.length) return false;
        await db.$transaction(ids.map((id, position) => db.block.update({ where: { id }, data: { position } })));
        return true;
      }
      case "answer": {
        const n = await db.answer.count({ where: { id: { in: ids }, pageId: parentId, page: { section: { course: owner } } } });
        if (n !== ids.length) return false;
        await db.$transaction(ids.map((id, position) => db.answer.update({ where: { id }, data: { position } })));
        return true;
      }
    }
  })();

  return ok ? noContent() : NextResponse.json({ error: "invalid_ids" }, { status: 400 });
}
