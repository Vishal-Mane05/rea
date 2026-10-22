import { NextResponse } from "next/server";
import { loadCourseTree, toPackage } from "@/lib/course";
import { db } from "@/lib/db";
import { buildExportZip, exportFormats, PlayerNotBuiltError, type ExportFormat } from "@/lib/export";
import { notFound } from "@/lib/http";
import { currentUser } from "@/lib/user";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const course = await loadCourseTree((await params).id, user.id);
  if (!course) return notFound();

  const format = (new URL(req.url).searchParams.get("format") ?? "scorm12") as ExportFormat;
  if (!exportFormats.includes(format)) {
    return NextResponse.json({ error: "invalid_format", allowed: exportFormats }, { status: 400 });
  }

  try {
    const { buffer, filename } = await buildExportZip(toPackage(course), format, course.ownerId);
    await db.course.update({ where: { id: course.id }, data: { publishedAt: new Date() } });
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof PlayerNotBuiltError) {
      return NextResponse.json({ error: "player_not_built", hint: "npm run build:player" }, { status: 503 });
    }
    throw e;
  }
}
