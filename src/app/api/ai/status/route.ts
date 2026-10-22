import { NextResponse } from "next/server";
import { AI_MODEL, aiConfigured } from "@/lib/ai/client";

export function GET() {
  return NextResponse.json({ configured: aiConfigured(), model: AI_MODEL });
}
