# staffpaper

印刷用の五線紙を PDF で作る。用紙と段組みを選ぶと、その場で PDF を作ってダウンロードする。

https://staffpaper.koeda.me

- 用紙: A4 / A3（A4 見開き。左右の面に A4 と同じ段組みを並べる）
- 段組み: 6・8・10・12・14・16 段 / 大譜表 6 組
- タイトル欄: なし / あり（上の余白の下に 20mm の欄を取り、中央に線を 1 本引く）
- 選んだ組み合わせの仕上がりを、PDF と同じ割り付けでプレビューに出す
- PDF はブラウザの中で作る。サーバには何も送らない

## 使い方

```
pnpm install
pnpm dev          # 開発サーバ
pnpm check        # lint / typecheck / test / build（CI と同じ）
pnpm exec playwright install chromium   # 撮影に使うブラウザ（最初の 1 回だけ）
pnpm build && pnpm screenshot           # 各画面を実ブラウザで撮って screenshots/ に置く（本番と同じヘッダで開く）
pnpm run deploy   # ビルドして Cloudflare へ（`pnpm deploy` は pnpm 自身の別コマンド）
```

デプロイは Cloudflare Workers の静的アセット配信（`wrangler.jsonc`）。
`wrangler login` するか、環境変数 `CLOUDFLARE_API_TOKEN` を渡して叩く。

## 構成

```
index.html              画面（設定とプレビュー）
ui.pen                  画面のデザイン（pen.dev）。アプリからは読まない
src/main.ts             画面の選択肢を作り、選ばれた組み合わせを描いてダウンロードさせる
src/style.css           画面の見た目。色と角丸は ui.pen のテーマ変数と同じ値
src/staff-paper.ts      用紙・段組み・タイトル欄の定義と、五線の割り付け
src/preview.ts          割り付けを SVG にする（PDF と同じ図形を使う）
src/pdf.ts              1 ページの PDF をライブラリなしで組み立てる
public/_headers         本番の配信に付けるヘッダ（CSP など）。中身は src/security-headers.test.ts が見張る
scripts/screenshot.mjs  各画面を実ブラウザで撮る。CSP の違反・コンソールのエラー・PDF のダウンロードの失敗があれば落ちる
```

段組みを足すときは `src/staff-paper.ts` の `LAYOUTS` に 1 行足す。画面の選択肢もそこから作られる。
プレビューと PDF は同じ `Sheet`（mm の図形の集まり）から描くので、見えている形と PDF の中身はずれない。
