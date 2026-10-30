# Questions

QUESTION: 設計書の技術スタックは hono-kit 0.16.0 だが、雛形は 0.17.0 → 0.17.0 の docs に従った
QUESTION: cron タブは src/jobs/sweepOrders.ts と createWorker の scheduled と書くが、0.17.0 は src/crons/<名前>.ts + createCron → docs に従った
QUESTION: 店の人（staff）をどう作るか書かれていない（role は API から変えられない）→ サインアップは常に customer。staff は DB の user.role を直接書き換えて作る前提とし、API は作らない
QUESTION: Better Auth の secret の置き場が書かれていない → wrangler.jsonc の vars にローカル用の値を置いた（本番は secret に差し替える前提）
QUESTION: Better Auth の表（user/session/account/verification）の drizzle 定義は設計書に無い → Better Auth の標準の列に role を足して手で書いた（src/db/schema.ts の auth の見出し）
QUESTION: 本の一覧にページ分けを付けるか設計書は明示しない（方針に pageQuerySchema とあるのは「一覧」全般）→ 本の一覧も pageQuerySchema（新しい順）にした
QUESTION: 本のサインアップ後の「在庫は 0 冊で始まる」を stocks の行で作るか不明（book は inventory を呼べない：inventory→book の向き）→ 行が無い本は在庫 0 とみなす。在庫の行は在庫を直す／戻すときに upsert する
QUESTION: PUT /books/[id] に version は要るか → 要らないと読んだ（楽観ロックの対象は在庫・注文・返品だけ）
QUESTION: restocks の主キーは「返品 id」だが本ごとの冊数を持つには 1 返品に複数行が要る → 主キーを (返品 id, 本 id) にした。2 回目は主キーに引っかかり batch ごと取り消される
QUESTION: 在庫の行が無い本の version → 0 とみなす。在庫を直すとき version 0 を送ると最初の行を INSERT（先に入っていたら STOCK_CHANGED）。押さえ・戻しは先に行を INSERT OR IGNORE（在庫 0）してから UPDATE する（INSERT で -n を入れる upsert は CHECK が先に当たるため使わない）
QUESTION: 本のレスポンスに在庫数のほか stockVersion も載せるか → 在庫を直すとき version を送る必要があるので stock と stockVersion を載せた
QUESTION: OUT_OF_STOCK の details の形は「足りない本と今の在庫数」としか無い → { books: [{ bookId, requested, stock }] }
QUESTION: 「◯% 引き」の「条件の金額」を持つか → 持つ（minAmount、既定 0）。fixed は minAmount >= 値引き、percent は 1〜100 を CHECK と入力検証の両方で守る
QUESTION: クーポンの開始・終了を API でどう受けるか（「日本時間で」）→ ISO 日時。オフセット（Z や +09:00）があればそのまま、無ければ日本時間として読む。開始は含み、終了は含まない（now >= endsAt で終了）。終了は開始より後であること
QUESTION: 定額クーポンが小計より大きいとき → 条件の金額 >= 値引き額なので普通は起きないが、念のため discountOf は小計を超えない
QUESTION: COUPON_NOT_APPLICABLE の details の形 → { reason: not_found | stopped | not_started | ended | below_minimum }
QUESTION: 止めたクーポンをもう一度止める → 失敗にせず最初に止めた日時のまま 200
QUESTION: クーポンの一覧にもページ分け（新しい順）を付けた
