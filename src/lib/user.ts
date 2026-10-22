import { cookies } from "next/headers";
import { SESSION_COOKIE, UnauthorizedError, userForToken } from "./auth";

/** The signed-in user for this request. Middleware rejects requests without a valid session first. */
export async function currentUser() {
  const user = await userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) throw new UnauthorizedError();
  return user;
}
