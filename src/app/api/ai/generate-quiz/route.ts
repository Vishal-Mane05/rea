import { NextResponse } from "next/server";
import { z } from "zod";
import { aiConfigured, aiErrorResponse, aiNotConfigured, generateStructured } from "@/lib/ai/client";
import { appendPages } from "@/lib/ai/create";
import { quizPrompt, quizSystemPrompt } from "@/lib/ai/prompts";
import { htmlToText } from "@/lib/ai/sanitize";
import { normalizePage, quizSchema, type NormalizedPage } from "@/lib/ai/schema";
import { touchCourseOfSection } from "@/lib/access";
import { db } from "@/lib/db";
import { notFound, parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

export const maxDuration = 180;

const schema = z.object({
  sectionId: z.string().uuid(),
  count: z.number().int().min(1).max(10).default(3),
});

export async function POST(req: Request) {
  if (!aiConfigured()) return aiNotConfigured();
  const user = await currentUser();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  const section = await db.section.findFirst({
    where: { id: body.data.sectionId, course: { ownerId: user.id } },
    include: {
      pages: {
        where: { type: "CONTENT" },
        orderBy: { position: "asc" },
        include: { blocks: { orderBy: { position: "asc" }, include: { children: { orderBy: { position: "asc" } } } } },
      },
    },
  });
  if (!section) return notFound();

  const content = section.pages
    .map((p) => {
      const blocks = p.blocks.filter((b) => b.parentId === null);
      const text = blocks
        .flatMap((b) => [b.html, b.caption, ...b.children.map((c) => c.html)])
        .map(htmlToText)
        .filter(Boolean)
        .join("\n");
      return text ? `## ${p.title}\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  if (!content) {
    return NextResponse.json(
      { error: "no_content", message: "Add some content pages to this section first — questions are written from them." },
      { status: 400 },
    );
  }

  try {
    const { questions } = await generateStructured({
      schema: quizSchema,
      system: quizSystemPrompt,
      prompt: quizPrompt(section.title, section.learningObjective, content.slice(0, 150_000), body.data.count),
      effort: "medium",
    });
    const pages = questions
      .filter((q) => q.type !== "CONTENT")
      .map(normalizePage)
      .filter((p): p is NormalizedPage => p !== null)
      .slice(0, body.data.count);
    if (pages.length === 0) return NextResponse.json({ error: "ai_invalid_output", message: "No usable questions came back — try again" }, { status: 502 });
    const created = await appendPages(section.id, pages);
    await touchCourseOfSection(section.id);
    return NextResponse.json({ pages: created }, { status: 201 });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
