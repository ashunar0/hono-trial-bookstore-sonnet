import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { buildApp } from "#/main";

const post = (path: string, body: unknown, cookie?: string) =>
  buildApp().request(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    },
    env,
  );

it("signs up with email and password as a customer, even when the body asks for staff", async () => {
  const email = `${crypto.randomUUID()}@example.com`;
  const res = await post("/api/auth/sign-up/email", {
    name: "New",
    email,
    password: "password-1234",
    role: "staff",
  });
  expect(res.status).toBe(200);

  const signIn = await post("/api/auth/sign-in/email", { email, password: "password-1234" });
  expect(signIn.status).toBe(200);
  const cookie = (signIn.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

  const session = await buildApp().request(
    "/api/auth/get-session",
    { headers: { Cookie: cookie } },
    env,
  );
  const body = (await session.json()) as { user: { email: string; role: string } };
  expect(body.user.email).toBe(email);
  expect(body.user.role).toBe("customer");
});
