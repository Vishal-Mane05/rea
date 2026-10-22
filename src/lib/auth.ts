import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "lf_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KEY_LEN = 64;

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  // hash against a throwaway salt when there is no account, so timing doesn't reveal which emails exist
  const [saltHex, hashHex] = stored?.split(":") ?? [randomBytes(16).toString("hex"), "00".repeat(KEY_LEN)];
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), KEY_LEN);
  return stored !== null && expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  return { token, expiresAt };
}

/** Resolve a raw cookie token to its user, or null when missing, unknown or expired. */
export async function userForToken(token: string | undefined) {
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function deleteSession(token: string | undefined) {
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export const sessionCookieOptions = (expires: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  expires,
});

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Only allow same-site relative redirect targets. */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
