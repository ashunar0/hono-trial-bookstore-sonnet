/**
 * In a real project, `pnpm wrangler types` can generate this.
 * When you add a binding (D1, queue, secret, ...) to wrangler.jsonc, add it here too
 */
declare global {
  // env from cloudflare:workers is typed as Cloudflare.Env, so connect it to this app's Env
  namespace Cloudflare {
    interface Env extends globalThis.Env {}
  }

  interface Env {
    DB: D1Database;
    /** Better Auth's signing secret. wrangler.jsonc vars for local; a secret in production */
    BETTER_AUTH_SECRET: string;
    /** Where the API is served, for Better Auth's links and cookies */
    BETTER_AUTH_URL: string;
  }
}

export {};
