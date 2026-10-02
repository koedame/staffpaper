/**
 * 配るバンドルに第三者のコードが混ざっていないことを見張る。
 *
 * このアプリは実行時の依存を持たず、配布物（dist）は src の自作コードだけで出来ている。
 * だから npm 由来の第三者ライセンスの表示は要らない。ライブラリや Vite の
 * ポリフィルが入ったら、このテストが落ちる。入れるなら、表示を添える仕組みと一緒に直す。
 * 画面に写した素材（Lucide のアイコン）の表示は public/third-party-licenses.txt にある。
 */

import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";

async function builtChunks(): Promise<Rollup.OutputChunk[]> {
  const result = await build({
    logLevel: "silent",
    build: { write: false },
  });
  const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[];
  return outputs.flatMap((o) =>
    o.output.filter((item): item is Rollup.OutputChunk => item.type === "chunk"),
  );
}

describe("配布するバンドル", () => {
  it("ビルドしたとき、src の自作モジュールだけで出来ていること（node_modules のコードを含まない）", async () => {
    const chunks = await builtChunks();
    expect(chunks.length).toBeGreaterThan(0);
    const modules = chunks.flatMap((c) => Object.keys(c.modules));
    expect(modules.filter((id) => id.includes("node_modules"))).toEqual([]);
  });

  it("ビルドしたとき、Vite の modulepreload ポリフィルが出力に入っていないこと", async () => {
    const chunks = await builtChunks();
    for (const chunk of chunks) {
      expect(chunk.code).not.toContain("modulepreload");
    }
  });
});
