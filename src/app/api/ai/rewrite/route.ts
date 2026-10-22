import { NextResponse } from "next/server";
import { z } from "zod";
import { aiConfigured, aiErrorResponse, aiNotConfigured, generateStructured } from "@/lib/ai/client";
import { rewriteActions, rewritePrompt, rewriteSystemPrompt, type RewriteAction } from "@/lib/ai/prompts";
import { sanitizeHtml } from "@/lib/ai/sanitize";
import { rewriteSchema } from "@/lib/ai/schema";
import { parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

export const maxDuration = 120;

const schema = z
  .object({
    html: z.string().trim().min(1).max(50_000),
    action: z.enum(Object.keys(rewriteActions) as [RewriteAction, ...RewriteAction[]]),
    instruction: z.string().trim().max(1000).optional(),
  })
  .refine((b) => (b.action !== "custom" && b.action !== "translate") || b.instruction, {
    message: "instruction is required for custom and translate",
    path: ["instruction"],
  });

export async function POST(req: Request) {
  if (!aiConfigured()) return aiNotConfigured();
  await currentUser();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const { html, action, instruction } = body.data;
  try {
    const out = await generateStructured({
      schema: rewriteSchema,
      system: rewriteSystemPrompt,
      prompt: rewritePrompt(sanitizeHtml(html), action, instruction),
      effort: "low",
      maxTokens: 16000,
    });
    return NextResponse.json({ html: sanitizeHtml(out.html) });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
