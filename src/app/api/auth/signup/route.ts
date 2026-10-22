import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword, normalizeEmail, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(320),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if (body.error) return body.error;
  const email = normalizeEmail(body.data.email);
  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }
  const user = await db.user.create({
    data: { email, name: body.data.name, passwordHash: await hashPassword(body.data.password) },
  });
  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
}
