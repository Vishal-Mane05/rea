import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { db } from "./db";

// Local-disk media storage. Files live at MEDIA_ROOT/<ownerId>/<uuid>.<ext>; the web app
// references them as /api/media/<id>/file and exports copy them into the package.

export const mediaRoot = () => path.resolve(process.cwd(), process.env.MEDIA_ROOT || "storage/media");

export const mediaUrl = (id: string) => `/api/media/${id}/file`;

/** matches `/api/media/<uuid>/file` (optionally prefixed by an origin) and captures the id */
export const mediaUrlPattern = /(?:https?:\/\/[^"'\s)]+)?\/api\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/file/g;

export type MediaKind = "image" | "video";

interface Sniffed {
  mimeType: string;
  ext: string;
  kind: MediaKind;
}

export const maxBytes: Record<MediaKind, number> = { image: 10 * 1024 * 1024, video: 200 * 1024 * 1024 };

/** Identify the file from its first bytes; the client-supplied mime type is never trusted. */
export function sniff(head: Uint8Array): Sniffed | null {
  const at = (offset: number, bytes: number[]) => bytes.every((b, i) => head[offset + i] === b);
  const ascii = (offset: number, s: string) => at(offset, [...s].map((c) => c.charCodeAt(0)));
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mimeType: "image/png", ext: "png", kind: "image" };
  if (at(0, [0xff, 0xd8, 0xff])) return { mimeType: "image/jpeg", ext: "jpg", kind: "image" };
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return { mimeType: "image/gif", ext: "gif", kind: "image" };
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { mimeType: "image/webp", ext: "webp", kind: "image" };
  if (ascii(4, "ftyp")) return { mimeType: "video/mp4", ext: "mp4", kind: "video" };
  if (at(0, [0x1a, 0x45, 0xdf, 0xa3])) return { mimeType: "video/webm", ext: "webm", kind: "video" };
  return null;
}

/** Read pixel dimensions from image headers (png, gif, webp, jpeg). */
export function imageSize(buf: Uint8Array, mimeType: string): { width: number; height: number } | null {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  try {
    switch (mimeType) {
      case "image/png":
        return { width: v.getUint32(16), height: v.getUint32(20) };
      case "image/gif":
        return { width: v.getUint16(6, true), height: v.getUint16(8, true) };
      case "image/webp": {
        const chunk = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
        if (chunk === "VP8 ") return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
        if (chunk === "VP8L") {
          const bits = v.getUint32(21, true);
          return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        if (chunk === "VP8X") {
          const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
          const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
          return { width: w + 1, height: h + 1 };
        }
        return null;
      }
      case "image/jpeg": {
        let i = 2;
        while (i + 9 < buf.length) {
          if (buf[i] !== 0xff) return null;
          const marker = buf[i + 1];
          const len = v.getUint16(i + 2);
          // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
          if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
            return { height: v.getUint16(i + 5), width: v.getUint16(i + 7) };
          }
          i += 2 + len;
        }
        return null;
      }
    }
  } catch {
    /* truncated header */
  }
  return null;
}

export class MediaError extends Error {
  constructor(
    public code: "unsupported_type" | "too_large" | "empty",
    public status: number,
  ) {
    super(code);
  }
}

/** Stream an uploaded file to disk, validating type by magic bytes and enforcing the size limit. */
export async function storeUpload(ownerId: string, file: File) {
  const id = crypto.randomUUID();
  const reader = file.stream().getReader();

  // buffer enough of the start to sniff the type and read image dimensions
  const headChunks: Uint8Array[] = [];
  let headLen = 0;
  while (headLen < 64 * 1024) {
    const { done, value } = await reader.read();
    if (done) break;
    headChunks.push(value);
    headLen += value.length;
  }
  const head = Buffer.concat(headChunks);
  if (head.length === 0) throw new MediaError("empty", 400);
  const type = sniff(head);
  if (!type) throw new MediaError("unsupported_type", 415);
  const limit = maxBytes[type.kind];
  if (file.size > limit) throw new MediaError("too_large", 413);

  const storageKey = `${ownerId}/${id}.${type.ext}`;
  const target = path.join(mediaRoot(), storageKey);
  await fs.mkdir(path.dirname(target), { recursive: true });

  let size = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      cb(size > limit ? new MediaError("too_large", 413) : null, chunk);
    },
  });
  const source = Readable.from(
    (async function* () {
      yield head;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield Buffer.from(value);
      }
    })(),
  );
  try {
    await pipeline(source, limiter, createWriteStream(target));
  } catch (e) {
    await fs.rm(target, { force: true });
    throw e;
  }

  const dims = type.kind === "image" ? imageSize(head, type.mimeType) : null;
  return db.mediaAsset.create({
    data: {
      id,
      ownerId,
      filename: (file.name || `upload.${type.ext}`).slice(0, 255),
      mimeType: type.mimeType,
      size,
      storageKey,
      width: dims?.width,
      height: dims?.height,
    },
  });
}

export const mediaPath = (storageKey: string) => {
  const root = mediaRoot();
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(root + path.sep)) throw new Error("invalid storage key");
  return full;
};

export const extOf = (storageKey: string) => path.extname(storageKey).slice(1);

export function fileStream(storageKey: string, range?: { start: number; end: number }) {
  return Readable.toWeb(createReadStream(mediaPath(storageKey), range)) as ReadableStream<Uint8Array>;
}

export async function deleteAsset(asset: { id: string; storageKey: string }) {
  await db.mediaAsset.delete({ where: { id: asset.id } });
  await fs.rm(mediaPath(asset.storageKey), { force: true });
}

/** Accepts an absolute http(s) URL or a reference to an uploaded asset (`/api/media/<id>/file`). */
export const isMediaOrHttpUrl = (s: string) =>
  /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/file$/.test(s) || /^https?:\/\/\S+$/i.test(s);
