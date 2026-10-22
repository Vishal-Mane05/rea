import { db } from "@/lib/db";
import { noContent, notFound } from "@/lib/http";
import { deleteAsset } from "@/lib/media";
import { currentUser } from "@/lib/user";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const asset = await db.mediaAsset.findFirst({ where: { id: (await params).id, ownerId: user.id } });
  if (!asset) return notFound();
  await deleteAsset(asset);
  return noContent();
}
