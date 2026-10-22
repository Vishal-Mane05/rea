import { db } from "@/lib/db";
import { notFound } from "@/lib/http";
import { fileStream } from "@/lib/media";
import { currentUser } from "@/lib/user";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) return notFound();
  const asset = await db.mediaAsset.findFirst({ where: { id, ownerId: user.id } });
  if (!asset) return notFound();

  const headers: Record<string, string> = {
    "Content-Type": asset.mimeType,
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${encodeURIComponent(asset.filename)}"`,
  };

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const size = asset.size;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    return new Response(fileStream(asset.storageKey, { start, end }), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(fileStream(asset.storageKey), { headers: { ...headers, "Content-Length": String(asset.size) } });
}
