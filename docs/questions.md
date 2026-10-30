# Questions

QUESTION: 設計書の技術スタックは hono-kit 0.16.0 だが、雛形は 0.17.0 → 0.17.0 の docs に従った
QUESTION: cron タブは src/jobs/sweepOrders.ts と createWorker の scheduled と書くが、0.17.0 は src/crons/<名前>.ts + createCron → docs に従った
QUESTION: 店の人（staff）をどう作るか書かれていない（role は API から変えられない）→ サインアップは常に customer。staff は DB の user.role を直接書き換えて作る前提とし、API は作らない
QUESTION: Better Auth の secret の置き場が書かれていない → wrangler.jsonc の vars にローカル用の値を置いた（本番は secret に差し替える前提）
QUESTION: Better Auth の表（user/session/account/verification）の drizzle 定義は設計書に無い → Better Auth の標準の列に role を足して手で書いた（src/db/schema.ts の auth の見出し）
