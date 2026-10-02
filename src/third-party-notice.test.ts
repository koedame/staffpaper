/**
 * 他人の素材を載せたら、著作権表示と許諾の文面を同じ作業で足させる。
 *
 * ダウンロードボタンのアイコンは Lucide（ISC。Feather 由来の部分は MIT）のパスを写している。
 * npm の依存ではないので、ロックファイルを見る検査には出ない。画面に SVG のパスがあるのに
 * public/third-party-licenses.txt が Lucide に触れていなければ落ちる。
 */

import { describe, expect, it } from "vitest";
import html from "../index.html?raw";
import notice from "../public/third-party-licenses.txt?raw";

describe("第三者の著作権表示", () => {
  it("index.html に SVG の path があるとき、third-party-licenses.txt に Lucide の表示があること", () => {
    expect(html).toContain("<path");
    expect(notice).toContain("Lucide");
    expect(notice).toContain("Lucide Icons and Contributors");
    expect(notice).toContain("Cole Bemis");
  });
});
