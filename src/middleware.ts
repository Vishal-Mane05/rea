import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, userForToken } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/signup", "/api/auth/", "/player/"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await userForToken(token)) return NextResponse.next();

  const res = pathname.startsWith("/api/")
    ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, req.url));
  if (token) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  // session lookup needs Prisma, so run on Node rather than the edge runtime
  runtime: "nodejs",
  matcher: ["/((?!_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)"],
};
