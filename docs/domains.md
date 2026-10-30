# Domains

<!-- The original of this page and lint/domains.mjs is ~/dev/hono/hono-trials/kakeibo. Other projects copy both from there: change them there first, then copy again. -->

The business rules live in `src/domains/<noun>/`, outside the routes. Every domain draws from the same list of file kinds below, and **what a file imports decides which kind it is**, so where a function goes is never a judgment of size. Between domains the rules are those of a modular monolith: one app and one database, split into domains that touch each other only through what each one publishes. `lint/domains.mjs` (rule `domains/imports`) stops an import that breaks the tables below.

```
src/domains/<noun>/
  index.ts            # what other domains and the routes may call: queries, usecases
  rules.ts            # no I/O: values, plain functions, failures, the shapes of values (monthSchema). Read directly, by anyone
  queries.ts          # reads (SELECT) of this domain's tables
  mutations.ts        # writes (INSERT / UPDATE / DELETE) of this domain's tables
  usecases/<verb>.ts  # one operation: read, check, write. Named by a verb (recordExpense)
  usecases/_<name>.ts # a part two usecases of this domain share (usecases/_withinBudget.ts)
```

A domain has only the kinds it has something to put in: no empty files (a domain of values alone has only `rules.ts`). The list is fixed: no other kind of file is added to a domain. Each kind has the same role and rules in every domain.

## Inside a domain: where a function goes

1. Needs no database, no deps, no HTTP → `rules.ts`
2. Only reads → `queries.ts`
3. Only writes → `mutations.ts`
4. Anything else (reads and writes, reads another domain, uses deps, decides from what it read) → `usecases/<verb>.ts`, in the domain that owns the table it writes

A read that needs several domains and writes nothing (a list with a flag from another domain, a summary) is put together in the route: it calls each domain's queries and combines the results. It is not a usecase, since a usecase is for a write.

What goes in `queries.ts` is decided by what the domain needs, not by what a response needs. Reading an order with its returns and refunds together belongs there when a usecase decides from it (how much can still be refunded); when only a response shows them together, it does not.

### Reads that make a response: `_read.ts`

When several endpoints of a resource return the same shape and making it takes more than one read (an order with its lines, returns and refunds; a cart with its books and an estimate), the reads go in that resource's `src/routes/<noun>/_read.ts`:

- It calls queries (and plain functions of rules, such as a price estimate) and returns the shape of `_response.ts`. It writes nothing
- It takes the db as an argument, so an endpoint that has just written reads what it wrote
- Only the routes of its own resource use it. Another resource reads only `_response.ts`, as before
- An endpoint that needs a single read to make its response does it in place, without a `_read.ts`

## Between domains

1. **Outside a domain, two of its files are read: `index.ts` and `rules.ts`**: `#/domains/budget/index` and `#/domains/budget/rules`, never `#/domains/budget/queries`. A domain's own files import each other directly, never their own `index.ts`
2. **`index.ts` publishes queries and usecases only** (one line each). Never rules (they are read directly), never mutations, never `usecases/_*`
3. **To change another domain's data, call that domain's usecase.** A usecase may call another domain's usecase through its `index.ts`
4. **A table belongs to one domain.** Only that domain's queries and mutations touch it. Another domain reads it through the owner's queries. `src/db/schema.ts` puts each domain's tables under a heading of their own, so the owner shows
5. **Domains do not depend on each other in a circle.** Not expense → budget and budget → expense. A circle means something sits in the wrong domain: move what both need into a domain of its own with rules only, below both. Expenses and budgets both need the list of categories, so it is the `category` domain. A word of this app's business (a category) is a domain; what any app has (yen, dates) goes in the shared place, `src/lib/`

### Why rules.ts is read directly

The layers run one way, each reading only those to its left:

```
src/lib ← rules ← src/db ← queries / mutations ← usecases ← routes
```

`index.ts` publishes queries, so whatever sits below queries (`rules.ts`, `src/db/**`) and reads it pulls in a layer above itself, and the imports go round (`src/db/schema.ts` → `coupon/index` → `coupon/queries` → `src/db/schema.ts`). `rules.ts` is the bottom of a domain and imports nothing but zod, so it can be read from anywhere without that. What `index.ts` keeps in is the mutations. `src/lib/` is below every domain: anything may read it, and it reads no domain

### Steps to place something

1. What does the code import? → the kind of file inside the domain
2. Who owns the table? → which domain. A value that is no table's (the categories) goes where everyone who needs it can read it one way
3. What does it touch in another domain? → only its `rules.ts` and what its `index.ts` shows. If it is not there, add a rule, a query or a usecase to the owner

A case these steps do not settle is a hole in the rules: stop and ask.

## What each file may import

| File                         | May import                                                                                                                           | May not                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `index.ts`                   | its own domain's queries, usecases                                                                                                   | rules, mutations, `usecases/_*`, anything outside its domain                             |
| `rules.ts`                   | another domain's `rules.ts`, `src/lib`, a schema library (zod), types                                                                | drizzle, `#/db`, hono, hono-kit (values), any `index.ts`, queries / mutations / usecases |
| `queries.ts`, `mutations.ts` | `#/db`, drizzle, hono-kit, its own domain's files, another domain's `rules.ts`, `src/lib`                                            | another domain's `index.ts` and other files, its own usecases                            |
| `usecases/*`                 | its own domain's queries / mutations / rules / `usecases/_*`, another domain's `index.ts` and `rules.ts`, `src/lib`, hono-kit        | drizzle, another usecase of its own domain (share through `usecases/_*`)                 |
| `src/routes/**`              | a domain's `index.ts` and `rules.ts`, its own resource's `_*` files, another resource's `_response.ts`, types from `#/db`, `src/lib` | a domain's other files, drizzle, `#/db` values, another resource's files                 |
| `src/db/**`                  | a domain's `rules.ts`, so a table can use a list of values (`categories`), `src/lib`                                                 | any `index.ts`, a domain's other files                                                   |
| `src/lib/**`                 | other files in `src/lib`, packages                                                                                                   | any domain, `src/db`, `src/routes/**`                                                    |
| anything else                | a domain's `index.ts` and `rules.ts`, `src/lib`                                                                                      | `src/routes/**`, a domain's other files                                                  |

A shape two resources return (a loan from `POST /books/[id]/borrow` and from `GET /loans`) goes in the `_response.ts` of the resource it is, and the other route imports it from there. It is the API's shape, not a rule: when what the API shows and what the domain holds part ways, only `_response.ts` changes.

## Writing

- **What must be written together lives in one domain.** When two rows must never be written one without the other, their tables belong to the same domain: the domain of the usecase that writes them. A carry-over of a budget is written when a month is closed, so it is the month's, and budget reads it through month's queries
- To write them together, the usecase puts the mutations in one `db.batch([...])` (D1; `db.transaction` on pg). It makes them all happen or none. It does not stop another request coming in between a read and the write: that is the version's job
- Every write goes through a usecase, even one with nothing to check (`setBudget`): otherwise "is there a check?" is a choice made each time, and adding one later moves the code
- `mutations.ts` returns the query, not yet run. The usecase awaits it and reads the result: no row back from an update means it found nothing or lost to another edit
- Forgetting the `await` would run nothing, silently: `typescript/no-floating-promises` with `checkThenables: true` (`oxlint --type-aware`) stops it
- Edits that must not overwrite another's use `updateWithVersion` from `hono-kit/sqlite` in `mutations.ts`
- Check order in a usecase follows hono-kit's rules.md: NOT_FOUND → ... → conflict

## Writing across domains

A usecase that changes several domains holds the steps and calls each domain's usecase in turn (cancelling an order: order → inventory → coupon). The routes and the cron call that one usecase. On D1 the steps cannot be one transaction, so a failure halfway must not break anything:

- **Every step can run twice with the same result.** Giving back stock acts only while the hold is still `reserved` (`UPDATE ... WHERE id = ? AND status = 'reserved'`); a record keyed by the request's id stops a second run
- **The state that decides the outcome is switched at the point of no return**, with the version: that switch is where one request wins and another loses. **An operation that takes (placing an order) switches it last**: hold everything first, then win. **An operation that lets go (cancelling) switches it first**: win first, then let go. Placing an order promises nothing until the switch. A cancel that switched last could give back stock while a payment came in at the same time: paid, with its stock gone
- **A step that died halfway is finished by running it again.** The state shows how far it got, and the cron that already runs (an expired payment, say) calls the usecase again
- On pg, pass `{ ...deps, db: tx }` to each usecase and the whole run becomes one transaction. That is why usecases take the db from deps instead of importing it
- Events between domains are not used while the domains share one database: they are harder to follow than a call. Something that may happen later on its own (a mail) can go through a Queue when it comes up
