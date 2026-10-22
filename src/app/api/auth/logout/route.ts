import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth";
import { noContent } from "@/lib/http";

export async function POST() {
  const jar = await cookies();
  await deleteSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return noContent();
}
