import { NextResponse } from "next/server";
import { templates } from "@/lib/templates";

export function GET() {
  return NextResponse.json(
    templates.map(({ key, name, description, emoji, sections }) => ({
      key,
      name,
      description,
      emoji,
      sectionCount: sections.length,
      pageCount: sections.reduce((n, s) => n + s.pages.length, 0),
    })),
  );
}
