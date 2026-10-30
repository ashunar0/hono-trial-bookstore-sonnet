import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createMiddleware } from "hono/factory";
import {
  Forbidden,
  Unauthorized,
  fail,
  getCurrentUser,
  guard,
  type CurrentUser,
  type DepsVariables,
} from "hono-kit";
import type { Db } from "./db/index";
import { accountsTable, sessionsTable, usersTable, verificationsTable } from "./db/schema";

export type Role = "customer" | "staff";

/** Better Auth (email and password). The role is the app's own column: input false, so no request can set it */
export const makeAuth = (db: Db, secret: string) =>
  betterAuth({
    secret,
    basePath: "/api/auth",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: usersTable,
        session: sessionsTable,
        account: accountsTable,
        verification: verificationsTable,
      },
    }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "customer", input: false },
      },
    },
  });

export type Auth = ReturnType<typeof makeAuth>;

/** Who is signed in: read the session (a cookie in headers) with Better Auth, or null */
export const sessionUserOf =
  (auth: Auth) =>
  async (
    headers: Headers,
  ): Promise<{ id: string; name: string; email: string; role: Role } | null> => {
    const session = await auth.api.getSession({ headers });
    if (session === null) return null;
    const { id, name, email } = session.user;
    const role: Role = session.user.role === "staff" ? "staff" : "customer";
    return { id, name, email, role };
  };

/** Only this role may call: 401 signed out, 403 another role */
export const requireRole = (role: Role) =>
  guard(
    [Unauthorized, Forbidden],
    createMiddleware<{ Variables: { currentUser: CurrentUser } & DepsVariables }>(
      async (c, next) => {
        const user = await getCurrentUser(c);
        if (user === null) throw fail(Unauthorized);
        if (user.role !== role) throw fail(Forbidden);
        c.set("currentUser", user);
        await next();
      },
    ),
  );
