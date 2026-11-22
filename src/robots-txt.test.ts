/**
 * クローラへの意思表示（`public/robots.txt`）を見張る。
 *
 * 消えたり、検索への掲載を止める形に変わったりしても画面は何も変わらない。
 * 検索と AI への入力は許し、AI の学習には使わせないという方針をここで固定する。
 */

import { describe, expect, it } from "vitest";
import headersFile from "../public/_headers?raw";
import robots from "../public/robots.txt?raw";

/** `User-agent: *` の節の `名前: 値` を { 名前（小文字）: 値 } にする。 */
function wildcardGroup(): Record<string, string> {
  const lines = robots.split("\n").map((line) => line.trim());
  const start = lines.findIndex((line) => /^user-agent:\s*\*$/i.test(line));
  expect(start, "robots.txt に User-agent: * の節が無い").toBeGreaterThanOrEqual(0);
  const group: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (/^user-agent:/i.test(line)) break;
    const at = line.indexOf(":");
    if (at > 0 && !line.startsWith("#")) {
      group[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
    }
  }
  return group;
}

describe("クローラへの意思表示（robots.txt）", () => {
  it("クローラが読むとき、検索と AI への入力は許し、AI の学習は許さない Content-Signal があること", () => {
    expect(wildcardGroup()["content-signal"]).toBe("search=yes, ai-input=yes, ai-train=no");
  });

  it("クローラが読むとき、サイト全体を取得してよいこと（Disallow が無い）", () => {
    expect(wildcardGroup().allow).toBe("/");
    expect(robots).not.toMatch(/^\s*disallow:\s*\S/im);
  });

  it("配るとき、文字コードを付けた text/plain で返す指定があること", () => {
    const lines = headersFile.split("\n");
    const start = lines.indexOf("/robots.txt");
    expect(start, "_headers に /robots.txt の節が無い").toBeGreaterThanOrEqual(0);
    expect(lines[start + 1]?.trim().toLowerCase()).toBe("content-type: text/plain; charset=utf-8");
  });
});
