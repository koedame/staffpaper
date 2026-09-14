// 五線紙の割り付けを決め、PDF にする。
// 寸法は mm・紙の上端を原点として考え、PDF に書く直前に pt・下端原点へ変換する。

import { buildPdf, num } from "./pdf.ts";

const PT_PER_MM = 72 / 25.4;

export const MARGIN = { x: 15, top: 15, bottom: 15 } as const;
/** 五線の太さ（pt） */
export const LINE_WIDTH = 0.5;

export type Paper = {
  id: string;
  label: string;
  /** mm */
  width: number;
  /** mm */
  height: number;
  /** 左右に並べる面の数。見開きなら 2 */
  columns: 1 | 2;
};

export const PAPERS = [
  { id: "A4", label: "A4", width: 210, height: 297, columns: 1 },
  { id: "A3-spread", label: "A3（A4 見開き）", width: 420, height: 297, columns: 2 },
] as const satisfies readonly Paper[];

export type Layout =
  | {
      id: string;
      label: string;
      kind: "single";
      /** 段数 */
      count: number;
      /** 五線 1 段の高さ（mm） */
      staffHeight: number;
    }
  | {
      id: string;
      label: string;
      kind: "grand";
      /** 大譜表の組数 */
      count: number;
      /** 五線 1 段の高さ（mm） */
      staffHeight: number;
      /** 組の中の 2 段の間隔（mm） */
      gap: number;
    };

// 段数が少ないほど、五線 1 段を大きく書ける
export const LAYOUTS = [
  { id: "06staves", label: "6 段", kind: "single", count: 6, staffHeight: 10 },
  { id: "08staves", label: "8 段", kind: "single", count: 8, staffHeight: 9 },
  { id: "10staves", label: "10 段", kind: "single", count: 10, staffHeight: 8 },
  { id: "12staves", label: "12 段", kind: "single", count: 12, staffHeight: 7.5 },
  { id: "14staves", label: "14 段", kind: "single", count: 14, staffHeight: 7 },
  { id: "16staves", label: "16 段", kind: "single", count: 16, staffHeight: 6.5 },
  {
    id: "grand-staff-06systems",
    label: "大譜表 6 組",
    kind: "grand",
    count: 6,
    staffHeight: 7,
    gap: 9,
  },
] as const satisfies readonly Layout[];

export type PaperId = (typeof PAPERS)[number]["id"];
export type LayoutId = (typeof LAYOUTS)[number]["id"];

export type StaffPaperFile = {
  fileName: string;
  bytes: Uint8Array<ArrayBuffer>;
};

export function createStaffPaper(paperId: PaperId, layoutId: LayoutId): StaffPaperFile {
  const paper = find(PAPERS, paperId);
  const layout: Layout = find(LAYOUTS, layoutId);
  const content = drawPage(paper, layout);
  return {
    fileName: `staffpaper-${paper.id}-${layout.id}.pdf`,
    bytes: buildPdf({
      width: paper.width * PT_PER_MM,
      height: paper.height * PT_PER_MM,
      content,
      title: `Staff paper ${paper.id} ${layout.id}`,
    }),
  };
}

function find<T extends { id: string }>(items: readonly T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`unknown id: ${id}`);
  return item;
}

function drawPage(paper: Paper, layout: Layout): string {
  const pen = new Pen(paper.height);
  const columnWidth = paper.width / paper.columns;
  for (let column = 0; column < paper.columns; column++) {
    const left = columnWidth * column + MARGIN.x;
    const right = columnWidth * (column + 1) - MARGIN.x;
    drawColumn(pen, left, right, paper.height, layout);
  }
  return [`${LINE_WIDTH} w`, "0 g 0 G", ...pen.ops].join("\n");
}

function drawColumn(pen: Pen, left: number, right: number, height: number, layout: Layout): void {
  // 段（または組）ごとに同じ高さの枠を割り当て、その中央に置く。
  // こうすると段の間隔と上下の余白が揃う
  const pitch = (height - MARGIN.top - MARGIN.bottom) / layout.count;
  if (layout.kind === "single") {
    for (let i = 0; i < layout.count; i++) {
      const top = MARGIN.top + pitch * i + (pitch - layout.staffHeight) / 2;
      drawStaff(pen, left, right, top, layout.staffHeight);
    }
    return;
  }
  const systemHeight = layout.staffHeight * 2 + layout.gap;
  for (let i = 0; i < layout.count; i++) {
    const top = MARGIN.top + pitch * i + (pitch - systemHeight) / 2;
    const bottom = top + systemHeight;
    drawStaff(pen, left, right, top, layout.staffHeight);
    drawStaff(pen, left, right, bottom - layout.staffHeight, layout.staffHeight);
    // 2 段をつなぐ左端の縦線と波かっこ
    pen.line(left, top, left, bottom);
    drawBrace(pen, left - 1, top, bottom);
  }
}

/** top を最上線にして、5 本の線を等間隔に引く */
function drawStaff(pen: Pen, left: number, right: number, top: number, height: number): void {
  for (let i = 0; i < 5; i++) {
    const y = top + (height * i) / 4;
    pen.line(left, y, right, y);
  }
}

/** 大譜表の波かっこ。x は波かっこの右端 */
function drawBrace(pen: Pen, x: number, top: number, bottom: number): void {
  const width = 2.6;
  const thickness = 1;
  const middle = (top + bottom) / 2;
  const half = middle - top;
  // 上半分と下半分を、端から中央の尖りに向かって同じ形で描く。
  // 内側の曲線を thickness だけ右にずらし、塗りつぶして太さを出す
  for (const [sign, end] of [
    [1, top],
    [-1, bottom],
  ] as const) {
    const p = (dx: number, dy: number): [number, number] => [x + dx, end + sign * dy];
    pen.fill([
      p(0, 0),
      [p(-0.9 * width, 0.12 * half), p(-0.1 * width, 0.88 * half), p(-width, half)],
      [p(-0.1 * width + thickness, 0.88 * half), p(-0.9 * width + thickness, 0.12 * half), p(0, 0)],
    ]);
  }
}

type Point = [number, number];

/** mm・上端原点の座標を受け取り、PDF の描画命令にする */
class Pen {
  readonly ops: string[] = [];
  readonly #paperHeight: number;

  constructor(paperHeight: number) {
    this.#paperHeight = paperHeight;
  }

  line(x0: number, y0: number, x1: number, y1: number): void {
    this.ops.push(`${this.point([x0, y0])} m ${this.point([x1, y1])} l S`);
  }

  /** start から 3 次ベジェ曲線をつないだ閉じた形を塗る */
  fill([start, ...curves]: [Point, ...[Point, Point, Point][]]): void {
    const segments = curves.map((curve) => `${curve.map((p) => this.point(p)).join(" ")} c`);
    this.ops.push(`${this.point(start)} m ${segments.join(" ")} f`);
  }

  private point([x, y]: Point): string {
    return `${num(x * PT_PER_MM)} ${num((this.#paperHeight - y) * PT_PER_MM)}`;
  }
}
