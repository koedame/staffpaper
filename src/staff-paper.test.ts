import { describe, expect, it } from "vitest";
import { createStaffPaper, LAYOUTS, MARGIN, PAPERS } from "./staff-paper.ts";

const PT_PER_MM = 72 / 25.4;

type Line = { x0: number; y0: number; x1: number; y1: number };
type Point = { x: number; y: number };

function text(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

function mediaBox(pdf: string): [number, number] {
  const match = pdf.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  if (!match) throw new Error("MediaBox not found");
  return [Number(match[1]), Number(match[2])];
}

const NUMBER = String.raw`(-?[\d.]+)`;

function lines(pdf: string): Line[] {
  const pattern = new RegExp(`^${NUMBER} ${NUMBER} m ${NUMBER} ${NUMBER} l S$`, "gm");
  return [...pdf.matchAll(pattern)].map((m) => ({
    x0: Number(m[1]),
    y0: Number(m[2]),
    x1: Number(m[3]),
    y1: Number(m[4]),
  }));
}

/** 塗りの形ごとに、その形を作る点の座標を返す */
function fills(pdf: string): Point[][] {
  return [...pdf.matchAll(/^(.*) f$/gm)].map((m) => {
    const numbers = [...(m[1] ?? "").matchAll(/-?[\d.]+/g)].map(Number);
    return Array.from({ length: numbers.length / 2 }, (_, i) => ({
      x: numbers[i * 2] ?? Number.NaN,
      y: numbers[i * 2 + 1] ?? Number.NaN,
    }));
  });
}

const combinations = PAPERS.flatMap((paper) => LAYOUTS.map((layout) => ({ paper, layout })));

describe("用紙", () => {
  it("A4 を選んだとき、ページが A4 縦の大きさになること", () => {
    const pdf = text(createStaffPaper("A4", "12staves").bytes);
    const [width, height] = mediaBox(pdf);
    expect(width).toBeCloseTo(210 * PT_PER_MM, 1);
    expect(height).toBeCloseTo(297 * PT_PER_MM, 1);
  });

  it("A3 見開きを選んだとき、ページが A3 横の大きさになること", () => {
    const pdf = text(createStaffPaper("A3-spread", "12staves").bytes);
    const [width, height] = mediaBox(pdf);
    expect(width).toBeCloseTo(420 * PT_PER_MM, 1);
    expect(height).toBeCloseTo(297 * PT_PER_MM, 1);
  });

  it("A3 見開きを選んだとき、左右の面に同じ段組みが並ぶこと", () => {
    const pdf = text(createStaffPaper("A3-spread", "10staves").bytes);
    const middle = 210 * PT_PER_MM;
    const left = lines(pdf).filter((line) => line.x1 < middle);
    const right = lines(pdf).filter((line) => line.x0 > middle);
    expect(left).toHaveLength(50);
    expect(right).toHaveLength(50);
    right.forEach((line, i) => {
      const mirror = left[i];
      if (!mirror) throw new Error("left face is shorter");
      expect(line.y0).toBe(mirror.y0);
      expect(line.x0 - mirror.x0).toBeCloseTo(middle, 1);
      expect(line.x1 - mirror.x1).toBeCloseTo(middle, 1);
    });
  });
});

describe("段組み", () => {
  it.each(LAYOUTS.filter((layout) => layout.kind === "single"))(
    "$label を A4 で作ると、段数 × 5 本の横線が引かれること",
    (layout) => {
      const pdf = text(createStaffPaper("A4", layout.id).bytes);
      const horizontal = lines(pdf).filter((line) => line.y0 === line.y1);
      expect(horizontal).toHaveLength(layout.count * 5);
      expect(fills(pdf)).toHaveLength(0);
    },
  );

  it("大譜表 6 組を A4 で作ると、組ごとに横線 10 本と左端の縦線と波かっこが描かれること", () => {
    const pdf = text(createStaffPaper("A4", "grand-staff-06systems").bytes);
    const horizontal = lines(pdf).filter((line) => line.y0 === line.y1);
    const vertical = lines(pdf).filter((line) => line.x0 === line.x1);
    const shapes = fills(pdf);
    expect(horizontal).toHaveLength(60);
    expect(vertical).toHaveLength(6);
    expect(shapes).toHaveLength(12);

    const ys = horizontal.map((line) => line.y0).sort((a, b) => b - a);
    for (let i = 0; i < 6; i++) {
      const system = ys.slice(i * 10, i * 10 + 10);
      const top = Math.max(...system);
      const bottom = Math.min(...system);
      // 縦線は左端で、上の段の最上線から下の段の最下線までをつなぐ
      const joins = vertical.filter(
        (line) =>
          Math.abs(Math.max(line.y0, line.y1) - top) < 0.01 &&
          Math.abs(Math.min(line.y0, line.y1) - bottom) < 0.01,
      );
      expect(joins).toHaveLength(1);
      expect(joins[0]?.x0).toBeCloseTo(MARGIN.x * PT_PER_MM, 1);
      // 波かっこは上半分と下半分の 2 つの塗りで、その組の高さの中に収まる
      const braces = shapes.filter((shape) =>
        shape.every((p) => p.y <= top + 0.01 && p.y >= bottom - 0.01),
      );
      expect(braces).toHaveLength(2);
    }
  });

  it.each(combinations)(
    "$paper.label・$layout.label のとき、線は各面の余白の内側に、波かっこは左の余白に収まること",
    ({ paper, layout }) => {
      const pdf = text(createStaffPaper(paper.id, layout.id).bytes);
      const tolerance = 0.01;
      const faceWidth = (paper.width / paper.columns) * PT_PER_MM;
      const margin = MARGIN.x * PT_PER_MM;
      const faceOf = (x: number) => Math.floor(x / faceWidth);
      const expectInsideVertically = (y: number) => {
        expect(y).toBeGreaterThanOrEqual(MARGIN.bottom * PT_PER_MM - tolerance);
        expect(y).toBeLessThanOrEqual((paper.height - MARGIN.top) * PT_PER_MM + tolerance);
      };

      for (const line of lines(pdf)) {
        const face = faceOf(line.x0);
        for (const x of [line.x0, line.x1]) {
          expect(x).toBeGreaterThanOrEqual(face * faceWidth + margin - tolerance);
          expect(x).toBeLessThanOrEqual((face + 1) * faceWidth - margin + tolerance);
        }
        expectInsideVertically(line.y0);
        expectInsideVertically(line.y1);
      }
      for (const shape of fills(pdf)) {
        const face = faceOf(Math.min(...shape.map((p) => p.x)));
        for (const p of shape) {
          expect(p.x).toBeGreaterThanOrEqual(face * faceWidth);
          expect(p.x).toBeLessThan(face * faceWidth + margin);
          expectInsideVertically(p.y);
        }
      }
    },
  );

  it.each(combinations)(
    "$paper.label・$layout.label のとき、五線が重ならず上から順に並ぶこと",
    ({ paper, layout }) => {
      const pdf = text(createStaffPaper(paper.id, layout.id).bytes);
      // 左の面の横線を上から並べ、5 本ずつを 1 段として見る
      const ys = lines(pdf)
        .filter(
          (line) => line.y0 === line.y1 && line.x0 < (paper.width / paper.columns) * PT_PER_MM,
        )
        .map((line) => line.y0)
        .sort((a, b) => b - a);
      const staves = Array.from({ length: ys.length / 5 }, (_, i) => ys.slice(i * 5, i * 5 + 5));
      for (const [i, staff] of staves.entries()) {
        const spacing = staff.slice(1).map((y, j) => (staff[j] ?? 0) - y);
        for (const s of spacing) expect(s).toBeCloseTo(spacing[0] ?? 0, 1);
        const next = staves[i + 1];
        if (next) expect(Math.min(...staff)).toBeGreaterThan(Math.max(...next));
      }
    },
  );
});

describe("PDF のファイル", () => {
  it.each(combinations)(
    "$paper.label・$layout.label のとき、相互参照表が各オブジェクトの位置を指していること",
    ({ paper, layout }) => {
      const bytes = createStaffPaper(paper.id, layout.id).bytes;
      const pdf = text(bytes);
      expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
      expect(pdf.endsWith("%%EOF\n")).toBe(true);

      const startxref = Number(pdf.match(/startxref\n(\d+)\n/)?.[1]);
      expect(pdf.slice(startxref, startxref + 5)).toBe("xref\n");
      const offsets = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
        Number(m[1]),
      );
      expect(offsets).toHaveLength(5);
      offsets.forEach((offset, i) => {
        expect(pdf.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
      });

      const stream = pdf.match(/<< \/Length (\d+) >>\nstream\n/);
      if (!stream || stream.index === undefined) throw new Error("content stream not found");
      const start = stream.index + stream[0].length;
      expect(pdf.slice(start + Number(stream[1]), start + Number(stream[1]) + 10)).toBe(
        "\nendstream",
      );
    },
  );

  it("ファイル名に用紙と段組みが入ること", () => {
    expect(createStaffPaper("A3-spread", "grand-staff-06systems").fileName).toBe(
      "staffpaper-A3-spread-grand-staff-06systems.pdf",
    );
    expect(createStaffPaper("A4", "08staves").fileName).toBe("staffpaper-A4-08staves.pdf");
  });
});
