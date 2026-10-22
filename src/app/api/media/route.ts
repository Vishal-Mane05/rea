import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MediaError, mediaUrl, storeUpload } from "@/lib/media";
import { currentUser } from "@/lib/user";

const toJson = (a: { id: string; filename: string; mimeType: string; size: number; width: number | null; height: number | null; createdAt: Date }) => ({
  id: a.id,
  filename: a.filename,
  mimeType: a.mimeType,
  kind: a.mimeType.startsWith("video/") ? "video" : "image",
  size: a.size,
  width: a.width,
  height: a.height,
  createdAt: a.createdAt,
  url: mediaUrl(a.id),
});

export async function GET(req: Request) {
  const user = await currentUser();
  const kind = new URL(req.url).searchParams.get("kind");
  const assets = await db.mediaAsset.findMany({
    where: { ownerId: user.id, ...(kind === "image" || kind === "video" ? { mimeType: { startsWith: `${kind}/` } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json(assets.map(toJson));
}

export async function POST(req: Request) {
  const user = await currentUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  try {
    const asset = await storeUpload(user.id, file);
    return NextResponse.json(toJson(asset), { status: 201 });
  } catch (e) {
    if (e instanceof MediaError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
