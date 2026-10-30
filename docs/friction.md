# Friction

- 場所: 見積もり（カート）。何が: 設計書の依存表は「cart → book・pricing」だが、domains.md の「読みだけの合成は route」に従うと cart ドメインは pricing を一度も呼ばず、cart/_read.ts（route 側）が cart・book・coupon・pricing を全部つなぐ。どうしたくなったか: 見積もりを `cart/usecases/` か `queries` に置いて cart が pricing を読む形にしたかった（usecase は書き込み用なので置けず、queries は他ドメインの index を読めない）。決まりの中で route の _read.ts に置いた
