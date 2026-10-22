import { z } from "zod";
import { aiConfigured, aiNotConfigured, generateStructured, toAiError } from "@/lib/ai/client";
import { createCourseFromOutline } from "@/lib/ai/create";
import { coursePrompt, courseSystemPrompt } from "@/lib/ai/prompts";
import { courseOutlineSchema } from "@/lib/ai/schema";
import { parseBody } from "@/lib/http";
import { currentUser } from "@/lib/user";

export const maxDuration = 300;

const schema = z.object({
  topic: z.string().trim().min(3).max(2000),
  audience: z.string().max(500).default(""),
  sourceText: z.string().max(100_000).default(""),
  sectionCount: z.number().int().min(1).max(10).default(3),
  includeQuiz: z.boolean().default(true),
  language: z.string().trim().min(2).max(40).default("English"),
  /** BCP-47-ish code stored on the course */
  languageCode: z.string().trim().min(2).max(10).default("en"),
});

// Server-sent events: {type:"progress", sections, chars} … then {type:"done", id} or {type:"error", ...}
export async function POST(req: Request) {
  if (!aiConfigured()) return aiNotConfigured();
  const user = await currentUser();
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const input = body.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      let lastSent = 0;
      try {
        send({ type: "progress", sections: 0, chars: 0 });
        const outline = await generateStructured({
          schema: courseOutlineSchema,
          system: courseSystemPrompt,
          prompt: coursePrompt(input),
          effort: "medium",
          onText: (soFar) => {
            if (soFar.length - lastSent < 400) return;
            lastSent = soFar.length;
            send({ type: "progress", sections: soFar.split('"learningObjective"').length - 1, chars: soFar.length });
          },
        });
        send({ type: "saving" });
        const course = await createCourseFromOutline(user.id, outline, input.languageCode);
        if (!course) send({ type: "error", error: "ai_invalid_output", message: "The AI returned an empty course — try again" });
        else send({ type: "done", id: course.id });
      } catch (e) {
        const err = toAiError(e);
        send({ type: "error", error: err.code, message: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
