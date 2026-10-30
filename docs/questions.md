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
QUESTION: 設計書のドメイン表は「cart は book・pricing を読む」だが、docs/domains.md は「複数ドメインを読むだけで書かない読みは route で組む」 → 見積もりは src/routes/cart/_read.ts で cart の queries・book の queries・pricing の rules を組み立てた。cart ドメインは pricing を import しない（book も使うのは setCartItem の「本があるか」だけ）
QUESTION: カートの本の数に上限があるか → 無し（在庫は確定のときに見る）
QUESTION: 見積もりに使う値段は → カートを見た時点の本の現在の値段（カートには値段を写さない）
QUESTION: カートの DELETE の返り値 → hono-kit の決まり（delete は { ok: true }）に従った。PUT は GET と同じ形のカートを返す
QUESTION: ?coupon= のコードが無いとき → COUPON_NOT_APPLICABLE（details.reason = not_found）の 422
QUESTION: 店の人がカートを触ろうとしたら → 権限表は「客」だけなので requireRole("customer") で 403
QUESTION: 確定の途中で在庫不足・クーポン使用済みになったとき「1 の注文を取り消す」の意味 → 取り消した注文が「キャンセル済み」として一覧に残ると、失敗した試みで客の一覧が汚れる。まだ何も約束していないので、押さえ・使用を戻したあと注文と行を消す（途中で落ちたら確定中のまま残るので cron が10分後にキャンセルする）
QUESTION: orders にクーポンのコード（couponCode）を写すか → レスポンスに couponCode があり、coupon の表は order が読めない（ルール4）ので、注文の時点の写しとして orders に couponCode 列を足した
QUESTION: 注文のレスポンスに customerId を載せるか → 設計書の例に無いが、店の人が全部の注文を見るので載せた
QUESTION: 支払い期限は確定中に作る注文の時点（now + 3 日）で決め、支払い待ちへの切り替えで動かさない
QUESTION: 注文の一覧の ?status= に placing を許すか → 確定中は誰にも見せないので受けない（400）
QUESTION: 確定の「4. 支払い待ちにする（version で見る）」→ 注文は version 1 で作り、切り替えは updateWithVersion(version 1)。cron に先にキャンセルされていれば行が返らず、押さえ・使用を自分で戻して ORDER_STATUS_CONFLICT（details.status は読み直した今の状態）
QUESTION: 在庫の押さえ・クーポンの使用を呼ぶ順 → 設計書の確定の段の順（在庫→クーポン）どおり。確認の順（COUPON_NOT_APPLICABLE→OUT_OF_STOCK→COUPON_ALREADY_USED）と同じ
QUESTION: PAYMENT_DEADLINE_PASSED と ORDER_STATUS_CONFLICT の順 → 確認の順の決まり（422→409）より先に「支払い待ちか」を見る。期限は支払い待ちの注文にだけ意味があるので、支払い済み・キャンセル済みは期限を過ぎていても 409。支払い待ちで期限を過ぎていれば 422。期限ちょうど（now == 期限）は払える
QUESTION: キャンセルの返金の置き場所 → 設計書は「合計を全額返す」だけ。refunds に返品 id 空の行を 1 つ入れる。切り替え（version）の成功を見てから書く必要があり、batch では分岐できないので、戻す段（giveBack）の先頭で入れる（id は refund-<注文 id> 固定で2回目は何もしない）。落ちても cron が戻す段から呼び直すので返金が漏れない
QUESTION: 他人の注文をキャンセル・支払おうとしたら → 404（客から他人の注文は 404 に見える）。確定中の注文も 404
QUESTION: キャンセルで version が合わないとき → ORDER_STATUS_CONFLICT（details.status は読み直した今の状態）。客が送る version はキャンセルだけ（設計書どおり）
QUESTION: 発送済みの注文を店の人がキャンセルしようとしたら → 409（発送前だけ）
QUESTION: 注文の行・カートの並びを何で決めるか → 割り振りの端数を受ける「最後の行」を決めるため、カートに入れた順（rowid）を注文の行の順にした
QUESTION: cron を 1 本にするか分けるか → 注文のキャンセル系（支払い期限切れ・確定中で止まった・戻しが止まった）は src/crons/sweepOrders.ts の 1 本。返品の在庫戻しは別の src/crons/restockReturns.ts。どちらも 15 分ごと（wrangler.jsonc の triggers.crons は同じ式 1 つ）
QUESTION: 1 回に拾う 100 件は「各」種類ごと → 支払い期限切れ・確定中・戻し漏れそれぞれ 100 件まで
QUESTION: 期限切れの判定 → paymentDueAt < now（ちょうど期限の時刻はまだ払える）。確定中の 10 分は createdAt < now - 10分
QUESTION: 「キャンセル済みで戻し終えた日時が空」を拾うときに、いま客が押したキャンセルが戻す途中でも拾う → 戻す段は何度呼んでも同じ結果なので害は無いとして grace は置かなかった
QUESTION: cron が 1 件失敗したとき → 他の注文は続け、最後に最初の失敗を throw（Workers が失敗として記録する）
QUESTION: 返品の申請で確かめる順 → 400 → NOT_FOUND（他人・確定中の注文、注文に無い行）→ 発送済みか（409 ORDER_STATUS_CONFLICT）→ 発送から14日（422）→ 冊数（409）。期限は発送済みの注文にだけ意味があるので、未発送を先に見る（支払いの期限と同じ考え方）。14日目の同じ時刻ちょうどまでは受ける
QUESTION: RETURN_QUANTITY_EXCEEDED の details → 注文の全部の行について { orderLineId, returnable }（「行ごとの返せる冊数」）
QUESTION: 同じ申請の行に同じ行を2回入れる／冊数 0／行 0 本 → 400
QUESTION: 同時に2つの申請が数え終えて両方通る穴 → 書いたあとにもう一度数え、発送した冊数を超えていれば自分の申請を取り下げて 409（両方が取り下げることはありうる）。D1 では条件つき INSERT の成否を batch の中で見られないため
QUESTION: 返品の返金で「最後に返す冊」の判定 → 完了した返品の冊数（受け取り時点）だけで数える。申請中は数えない。受け取りが同時に走ると端数がずれうる（返金の id が返品 id 固定・返品の version で2回目は弾く）
QUESTION: 受け取りの「完了にする」と「返金を記録」は同じドメインの1回の batch。返金の id は refund-<返品 id> 固定で、version の書き込みに負けた側の返金は主キーで無視される
QUESTION: 返品の断る・受け取るの version は → 客からは送らない（サーバーが読んだ version）
QUESTION: 返品の在庫戻しの cron は receiveReturn(caller=cron) を呼ぶ。店が完了済みの返品をもう一度受け取ろうとしたら、戻し漏れがあっても 409（cron だけが続きから）
QUESTION: 返品の一覧 GET /returns も新しい申請順のページ分け。レスポンスの形は注文の中の returns と同じ（orders/_response.ts の returnResponse で作る）
