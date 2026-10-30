import { createApp } from "hono-kit";
import { createWorker } from "hono-kit/worker";
import { makeAuth, sessionUserOf } from "./auth";
import { wireDb } from "./db/index";
import { crons, registerRoutes } from "./routes.gen";

/** What handlers, middleware and jobs read in c.var.deps. Built per request; tests swap parts of it */
export const makeDeps = (env: Env) => {
  const db = wireDb(env.DB);
  const auth = makeAuth(db, env.BETTER_AUTH_SECRET);
  return { db, auth, sessionUser: sessionUserOf(auth) };
};

export const buildApp = (deps = makeDeps, clock?: () => Date) => {
  const app = createApp({ makeDeps: deps, clock });
  // The app's own middleware (an error page, CORS, ...) goes here, before the routes
  // Better Auth's own endpoints (sign-up, sign-in, sign-out)
  app.on(["GET", "POST"], "/api/auth/*", (c) => c.var.deps.auth.handler(c.req.raw));
  registerRoutes(app);
  return app;
};

// crons: the ones in src/crons, each on its schedule (listed in wrangler.jsonc triggers.crons too)
export default createWorker({ makeDeps, fetch: buildApp().fetch, crons });
