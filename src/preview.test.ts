import { describe, expect, it } from "vitest";
import { sheetPaths } from "./preview.ts";
import { createStaffPaper, drawSheet, type LayoutId } from "./staff-paper.ts";

const PT_PER_MM = 72 / 25.4;

/** PDF の描画命令から直線を拾い、mm・紙の上端を原点とした座標に戻す */
function pdfSegments(layoutId: LayoutId, titleField: boolean, height: number): number[][] {
  const pdf = new TextDecoder("latin1").decode(createStaffPaper("A4", layoutId, titleField).bytes);
  const pattern = /^([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l S$/gm;
  return [...pdf.matchAll(pattern)].map((m) => [
    Number(m[1]) / PT_PER_MM,
    height - Number(m[2]) / PT_PER_MM,
    Number(m[3]) / PT_PER_MM,
    height - Number(m[4]) / PT_PER_MM,
  ]);
}

/** d 属性の直線を [x0, y0, x1, y1] の並びにする */
function segments(d: string): number[][] {
  return [...d.matchAll(/M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)/g)].map((m) =>
    m.slice(1).map(Number),
  );
}

describe("プレビュー", () => {
  it("用紙を描いたとき、同じ組み合わせの PDF と線が同じ位置に並ぶこと", () => {
    const sheet = drawSheet("A4", "12staves", true);
    const found = segments(sheetPaths(sheet).staves);
    const expected = pdfSegments("12staves", true, sheet.height);
    expect(found).toHaveLength(expected.length);
    found.forEach((segment, i) => {
      segment.forEach((value, axis) => {
        expect(value).toBeCloseTo(expected[i]?.[axis] ?? Number.NaN, 1);
      });
    });
  });

  it("12 段でタイトル欄ありのとき、五線 60 本とタイトル欄の線 1 本が引かれること", () => {
    const sheet = drawSheet("A4", "12staves", true);
    expect(segments(sheetPaths(sheet).staves)).toHaveLength(61);
    expect(sheetPaths(sheet).braces).toBe("");
  });

  it("大譜表を選んだとき、波かっこが閉じた塗りとして組数 × 2 個描かれること", () => {
    const { braces } = sheetPaths(drawSheet("A4", "grand-staff-06systems", false));
    expect([...braces.matchAll(/Z/g)]).toHaveLength(12);
    expect([...braces.matchAll(/C /g)]).toHaveLength(24);
  });

  it("A3 見開きを選んだとき、用紙の大きさが viewBox と同じ mm で返ること", () => {
    const sheet = drawSheet("A3-spread", "16staves", false);
    expect([sheet.width, sheet.height]).toEqual([420, 297]);
  });
});
