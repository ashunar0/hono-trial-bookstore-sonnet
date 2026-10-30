import { expect, it } from "vitest";
import { alice, request, staff } from "../../../test/fixtures";

const input = { title: "Hono 入門", author: "Yusuke", price: 1500 };

const register = async (body: unknown = input) => {
  const res = await request(staff, "POST", "/books", body);
  return { res, json: (await res.json()) as { id: string } };
};

it("lets staff register a book and anyone read it without signing in", async () => {
  const { res, json } = await register();
  expect(res.status).toBe(200);
  expect(json).toMatchObject(input);

  const got = await request(null, "GET", `/books/${json.id}`);
  expect(got.status).toBe(200);
  expect(await got.json()).toMatchObject({ id: json.id, ...input });

  const list = await request(null, "GET", "/books");
  const body = (await list.json()) as { items: { id: string }[] };
  expect(body.items.map((b) => b.id)).toContain(json.id);
});

it("answers 401 signed out and 403 for a customer when registering", async () => {
  expect((await request(null, "POST", "/books", input)).status).toBe(401);
  expect((await request(alice, "POST", "/books", input)).status).toBe(403);
});

it("answers 400 with the wrong fields (price must be a positive whole number)", async () => {
  expect((await register({ ...input, price: 0 })).res.status).toBe(400);
  expect((await register({ ...input, price: 10.5 })).res.status).toBe(400);
  expect((await register({ title: "x" })).res.status).toBe(400);
});

it("changes title, author and price with PUT, and 404s a missing book", async () => {
  const { json } = await register();
  const res = await request(staff, "PUT", `/books/${json.id}`, { ...input, price: 1800 });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ price: 1800 });

  expect((await request(staff, "PUT", "/books/nope", input)).status).toBe(404);
  expect((await request(alice, "PUT", `/books/${json.id}`, input)).status).toBe(403);
  expect((await request(null, "GET", "/books/nope")).status).toBe(404);
});
