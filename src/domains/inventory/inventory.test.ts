import { expect, it } from "vitest";
import { db, request, staff } from "../../../test/fixtures";
import { findStock, releaseReservation, reserveStock, restockReturn } from "./index";

type Shown = { id: string; stock: number; stockVersion: number };

const newBook = async () => {
  const res = await request(staff, "POST", "/books", { title: "t", author: "a", price: 1000 });
  return (await res.json()) as Shown;
};

const setStock = (id: string, stock: number, version: number) =>
  request(staff, "PUT", `/books/${id}/stock`, { stock, version });

it("starts at 0, sets the stock with the version it read, and refuses a stale version", async () => {
  const book = await newBook();
  expect(book).toMatchObject({ stock: 0, stockVersion: 0 });

  const first = await setStock(book.id, 10, 0);
  expect(await first.json()).toMatchObject({ stock: 10, stockVersion: 1 });

  const second = await setStock(book.id, 7, 1);
  expect(await second.json()).toMatchObject({ stock: 7, stockVersion: 2 });

  const stale = await setStock(book.id, 99, 1);
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ error: { code: "STOCK_CHANGED" } });
  const stale0 = await setStock(book.id, 99, 0);
  expect(stale0.status).toBe(409);
});

it("answers 404 for a missing book, 403 to a customer, 400 to a negative stock", async () => {
  expect((await setStock("nope", 1, 0)).status).toBe(404);
  const book = await newBook();
  expect((await setStock(book.id, -1, 0)).status).toBe(400);
});

it("changes the version when an order takes stock in between, so the shop's edit is turned away", async () => {
  const book = await newBook();
  await setStock(book.id, 5, 0);
  await reserveStock({ db: db() }, crypto.randomUUID(), [{ bookId: book.id, quantity: 2 }]);
  const stale = await setStock(book.id, 5, 1);
  expect(stale.status).toBe(409);
  expect(await findStock(db(), book.id)).toMatchObject({ stock: 3, version: 2 });
});

it("holds all books or none, and names the short book with what is left", async () => {
  const a = await newBook();
  const b = await newBook();
  await setStock(a.id, 5, 0);
  await setStock(b.id, 1, 0);
  const id = crypto.randomUUID();

  const result = await reserveStock({ db: db() }, id, [
    { bookId: a.id, quantity: 2 },
    { bookId: b.id, quantity: 2 },
  ]);
  expect(result).toEqual({
    ok: false,
    error: {
      code: "OUT_OF_STOCK",
      details: { books: [{ bookId: b.id, requested: 2, stock: 1 }] },
    },
  });
  expect((await findStock(db(), a.id))?.stock).toBe(5);
  expect((await findStock(db(), b.id))?.stock).toBe(1);
});

it("treats a book with no stocks row as 0 in stock", async () => {
  const a = await newBook();
  const result = await reserveStock({ db: db() }, crypto.randomUUID(), [
    { bookId: a.id, quantity: 1 },
  ]);
  expect(result.ok).toBe(false);
});

it("gives a hold back once, however often it is asked", async () => {
  const a = await newBook();
  await setStock(a.id, 5, 0);
  const id = crypto.randomUUID();
  await reserveStock({ db: db() }, id, [{ bookId: a.id, quantity: 3 }]);
  expect((await findStock(db(), a.id))?.stock).toBe(2);

  await releaseReservation({ db: db() }, id);
  await releaseReservation({ db: db() }, id);
  expect((await findStock(db(), a.id))?.stock).toBe(5);

  // a hold that never happened changes nothing
  await releaseReservation({ db: db() }, crypto.randomUUID());
  expect((await findStock(db(), a.id))?.stock).toBe(5);
});

it("holding twice with the same id holds once", async () => {
  const a = await newBook();
  await setStock(a.id, 5, 0);
  const id = crypto.randomUUID();
  await reserveStock({ db: db() }, id, [{ bookId: a.id, quantity: 3 }]);
  const again = await reserveStock({ db: db() }, id, [{ bookId: a.id, quantity: 3 }]);
  expect(again.ok).toBe(true);
  expect((await findStock(db(), a.id))?.stock).toBe(2);
});

it("puts a return back on the shelf once per return id", async () => {
  const a = await newBook();
  await setStock(a.id, 1, 0);
  const returnId = crypto.randomUUID();
  await restockReturn({ db: db() }, returnId, [{ bookId: a.id, quantity: 2 }]);
  await restockReturn({ db: db() }, returnId, [{ bookId: a.id, quantity: 2 }]);
  expect((await findStock(db(), a.id))?.stock).toBe(3);
});
