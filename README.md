# staffpaper

印刷用の五線紙を PDF で作る。用紙と段組みを選ぶと、その場で PDF を作ってダウンロードする。

https://staffpaper.koeda.me

- 用紙: A4 / A3（A4 見開き。左右の面に A4 と同じ段組みを並べる）
- 段組み: 6・8・10・12・14・16 段 / 大譜表 6 組
- PDF はブラウザの中で作る。サーバには何も送らない

## 使い方

```
pnpm install
pnpm dev          # 開発サーバ
pnpm check        # lint / typecheck / test / build（CI と同じ）
pnpm run deploy   # ビルドして Cloudflare へ（`pnpm deploy` は pnpm 自身の別コマンド）
```

デプロイは Cloudflare Workers の静的アセット配信（`wrangler.jsonc`）。
`wrangler login` するか、環境変数 `CLOUDFLARE_API_TOKEN` を渡して叩く。

## 構成

```
index.html              画面（用紙と段組みを選んでダウンロード）
src/main.ts             画面の選択肢を作り、選ばれた組み合わせの PDF をダウンロードさせる
src/staff-paper.ts      用紙・段組みの定義と、五線の割り付け
src/pdf.ts              1 ページの PDF をライブラリなしで組み立てる
```

段組みを足すときは `src/staff-paper.ts` の `LAYOUTS` に 1 行足す。画面の選択肢もそこから作られる。
