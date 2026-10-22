import { NextResponse } from "next/server";
import { z } from "zod";

export const noContent = () => new NextResponse(null, { status: 204 });
export const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function parseBody<T extends z.ZodType>(req: Request, schema: T) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { error: NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 }) } as const;
  }
  return { data: parsed.data as z.infer<T> } as const;
}
