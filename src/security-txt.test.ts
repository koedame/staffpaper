/**
 * 脆弱性の報告窓口（`public/.well-known/security.txt`、RFC 9116）を見張る。
 *
 * 消えたり、報告先が変わったり、`index.html` に化けて配られたりしても画面は何も変わらず、
 * 見つけた人が報告できなくなって初めて気づく。ここで中身と配り方を固定する。
 * `Expires` が切れていないかは配信側の点検が見るので、ここでは形だけを見る。
 */

import { describe, expect, it } from "vitest";
import securityTxt from "../public/.well-known/security.txt?raw";
import headersFile from "../public/_headers?raw";

/** `security.txt` の `名前: 値` の行を { 名前（小文字）: 値 } にする。 */
function fields(): Record<string, string> {
  return Object.fromEntries(
    securityTxt
      .split("\n")
      .filter((line) => line.includes(":") && !line.startsWith("#"))
      .map((line) => {
        const at = line.indexOf(":");
        return [line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim()];
      }),
  );
}

describe("脆弱性の報告窓口（security.txt）", () => {
  it("見つけた人が報告するとき、リポジトリの非公開の報告フォームに案内されること", () => {
    expect(fields().contact).toBe("https://github.com/koedame/staffpaper/security/advisories/new");
  });

  it("期限を読むとき、日時として読める Expires があること", () => {
    const expires = fields().expires ?? "";
    expect(expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    expect(Number.isNaN(Date.parse(expires))).toBe(false);
  });

  it("正規の置き場を読むとき、本番のドメインの /.well-known/security.txt を指すこと", () => {
    expect(fields().canonical).toBe("https://staffpaper.koeda.me/.well-known/security.txt");
  });

  it("配るとき、ページの素通し（index.html）ではなく text/plain で返す指定があること", () => {
    const lines = headersFile.split("\n");
    const start = lines.indexOf("/.well-known/security.txt");
    expect(start, "_headers に /.well-known/security.txt の節が無い").toBeGreaterThanOrEqual(0);
    expect(lines[start + 1]?.trim().toLowerCase()).toBe("content-type: text/plain; charset=utf-8");
  });
});
