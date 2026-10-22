import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, normalizeEmail, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/http";

const schema = z.object({ email: z.string().max(320), password: z.string().max(200) });

export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const user = await db.user.findUnique({ where: { email: normalizeEmail(body.data.email) } });
  if (!(await verifyPassword(body.data.password, user?.passwordHash ?? null)) || !user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({ id: user.id, email: user.email, name: user.name });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
}
