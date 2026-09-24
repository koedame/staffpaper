/**
 * 本番の配信に付けるヘッダ（`public/_headers`）を見張る。
 *
 * ヘッダはブラウザ側の最後の守りで、外れても画面は何も変わらない。消えたこと・緩んだことに
 * 誰も気づかないので、ここで中身を固定する。緩めるときは、なぜ要るのかをテストの側に書く。
 */

import { describe, expect, it } from "vitest";
import file from "../public/_headers?raw";

/** `_headers` の `/*` の節を { ヘッダ名（小文字）: 値 } にする。 */
function rootHeaders(): Record<string, string> {
  const lines = file.split("\n");
  const start = lines.indexOf("/*");
  expect(start, "_headers に /* の節が無い").toBeGreaterThanOrEqual(0);
  const headers: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(line)) break;
    const at = line.indexOf(":");
    headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  return headers;
}

/** CSP を { ディレクティブ: [値...] } にする。 */
function csp(): Record<string, string[]> {
  const policy = rootHeaders()["content-security-policy"] ?? "";
  return Object.fromEntries(
    policy
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name, values]),
  );
}

describe("本番の配信ヘッダ", () => {
  it("ページを開いたとき、自分のオリジンのスクリプトだけが動くこと（インラインも eval も許さない）", () => {
    expect(csp()["script-src"]).toEqual(["'self'"]);
  });

  it("ページが通信しようとしたとき、自分のオリジンにしか出られないこと（PDF はブラウザの中で作り、どこにも送らない）", () => {
    expect(csp()["connect-src"]).toEqual(["'self'"]);
    expect(csp()["default-src"]).toEqual(["'self'"]);
  });

  it("スタイル・画像・フォントを読むとき、自分のオリジンのものだけが使われること", () => {
    // プレビューの SVG に用紙の縦横比を渡す CSS 変数は element.style（CSSOM）で書くので、
    // style 属性を HTML に書くのと違って 'unsafe-inline' が無くても通る
    expect(csp()["style-src"]).toEqual(["'self'"]);
    expect(csp()["img-src"]).toEqual(["'self'"]);
    expect(csp()["font-src"]).toEqual(["'self'"]);
  });

  it("外のサイトが枠で埋め込もうとしたとき、表示されず、base とプラグインとフォームの送信先も使えないこと", () => {
    expect(csp()["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp()["object-src"]).toEqual(["'none'"]);
    expect(csp()["base-uri"]).toEqual(["'none'"]);
    // 設定のフォームは送信せず、画面の中で PDF を作る
    expect(csp()["form-action"]).toEqual(["'none'"]);
  });

  it("ページが権限を求めたとき、どの機能も許されないこと（何の権限も使わない）", () => {
    const features = (rootHeaders()["permissions-policy"] ?? "")
      .split(",")
      .map((part) => part.trim().split("="));
    expect(features.map(([name]) => name)).toEqual(
      expect.arrayContaining(["camera", "microphone", "geolocation"]),
    );
    for (const [name, allowlist] of features) {
      expect(allowlist, `${name} が許されている`).toBe("()");
    }
  });

  it("HTTP で開いたとき、HTTPS に強制され、型の推測と参照元の送信も止まること", () => {
    const headers = rootHeaders();
    expect(headers["strict-transport-security"]).toMatch(/^max-age=\d{8,}/);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("no-referrer");
  });
});
