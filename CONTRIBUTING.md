# 開発に加わる

Issue と Pull Request を歓迎します。段組みや用紙の追加、印刷したときのずれの報告が特に助かります。

## 貢献したものの権利

Pull Request で送ったコードや文章は、このリポジトリと同じ [MIT ライセンス](LICENSE)で提供されたものとして扱います。署名や同意書（CLA）は要りません。
他の人が書いたもの・出どころが分からないものは、ライセンスが MIT と両立すると確かめられないかぎり含めないでください。

## 手元で動かす

Node 22 以上と pnpm が要ります。

```
pnpm install
pnpm dev          # 開発サーバ
pnpm check        # lint / typecheck / test / build（CI と同じ）
```

## 画面を実ブラウザで確かめる

```
pnpm exec playwright install chromium   # 撮影に使うブラウザ（最初の 1 回だけ）
pnpm build && pnpm screenshot           # 各画面を実ブラウザで撮って screenshots/ に置く（本番と同じヘッダで開く）
```

見た目・レイアウト・実寸はユニットテストでは測れないので、画面を変えたら撮って目で見ます。
各画面で PDF のダウンロードまで押し、CSP の違反・コンソールのエラー・ダウンロードの失敗があれば落ちます。

README の絵は `docs/screen.png`（`pc-a4-12staves-title` の撮影結果）です。画面の見た目を変えたら撮り直します。

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
public/third-party-licenses.txt  載せている他人の素材（Lucide のアイコン）の著作権表示と許諾の文面。素材を足したら同じファイルに足す（src/third-party-notice.test.ts が見張る）
scripts/screenshot.mjs  各画面を実ブラウザで撮る
```

段組みを足すときは `src/staff-paper.ts` の `LAYOUTS` に 1 行足す。画面の選択肢もそこから作られる。
プレビューと PDF は同じ `Sheet`（mm の図形の集まり）から描くので、見えている形と PDF の中身はずれない。
