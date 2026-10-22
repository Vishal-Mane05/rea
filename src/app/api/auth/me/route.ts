import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, userForToken } from "@/lib/auth";

export async function GET() {
  const user = await userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
