import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import type { z } from "zod";

export const AI_MODEL = "claude-opus-5-5";

/** Retries a refused request on a model chosen by the API for the refusal category. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim());

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export class AiError extends Error {
  constructor(
    readonly code: "ai_not_configured" | "ai_refused" | "ai_truncated" | "ai_invalid_output" | "ai_rate_limited" | "ai_failed",
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const aiNotConfigured = () =>
  NextResponse.json(
    { error: "ai_not_configured", message: "Add ANTHROPIC_API_KEY to apps/web/.env to enable AI" },
    { status: 503 },
  );

export function aiErrorResponse(e: unknown) {
  const err = toAiError(e);
  return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
}

export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return new AiError("ai_not_configured", "The Anthropic API key was rejected — check ANTHROPIC_API_KEY in apps/web/.env", 503);
  if (e instanceof Anthropic.RateLimitError) return new AiError("ai_rate_limited", "The AI is busy right now — try again in a minute", 429);
  if (e instanceof Anthropic.APIError) return new AiError("ai_failed", `AI request failed (${e.status ?? "network"})`, 502);
  console.error("AI request failed", e);
  return new AiError("ai_failed", "AI request failed", 502);
}

interface StructuredRequest<S extends z.ZodType> {
  schema: S;
  system: string;
  prompt: string;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
  /** called with the accumulated JSON text while it streams */
  onText?: (soFar: string) => void;
}

/** One streamed Claude call whose answer is validated against `schema`. */
export async function generateStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
  if (!aiConfigured()) throw new AiError("ai_not_configured", "Add ANTHROPIC_API_KEY to apps/web/.env to enable AI", 503);

  const stream = getClient().beta.messages.stream({
    model: AI_MODEL,
    max_tokens: req.maxTokens ?? 64000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system: req.system,
    messages: [{ role: "user", content: req.prompt }],
    output_config: { effort: req.effort, format: betaZodOutputFormat(req.schema) },
  });

  if (req.onText) {
    let soFar = "";
    stream.on("text", (delta) => {
      soFar += delta;
      req.onText!(soFar);
    });
  }

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new AiError("ai_refused", "The AI declined this request — try rephrasing it", 422);
  if (message.stop_reason === "max_tokens") throw new AiError("ai_truncated", "The answer was too long — ask for less content", 422);
  if (message.parsed_output == null) throw new AiError("ai_invalid_output", "The AI returned an unexpected answer — try again", 502);
  return message.parsed_output as z.infer<S>;
}
