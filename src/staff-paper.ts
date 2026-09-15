// 五線紙の割り付けを決め、PDF にする。
// 寸法は mm・紙の上端を原点として考え、PDF に書く直前に pt・下端原点へ変換する。
// 割り付けの結果は Sheet（mm の図形の集まり）として取り出せる。画面のプレビューは
// PDF と同じ Sheet から描くので、見えている形と PDF の中身がずれない。

import { buildPdf, num } from "./pdf.ts";

const PT_PER_MM = 72 / 25.4;

export const MARGIN = { x: 15, top: 15, bottom: 15 } as const;
/** 五線の太さ（pt） */
export const LINE_WIDTH = 0.5;

/** タイトルを書く欄。上の余白の下にこの高さを取り、面の中央に線を 1 本引く（mm） */
export const TITLE_FIELD = { height: 20, lineY: 13, lineLength: 120 } as const;

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

/** mm・紙の上端を原点とした点 */
export type Point = [number, number];

export type Shape =
  | { kind: "line"; from: Point; to: Point }
  /** start から 3 次ベジェ曲線をつないだ閉じた形 */
  | { kind: "fill"; start: Point; curves: [Point, Point, Point][] };

/** 1 枚の紙に引くものすべて。単位は mm、原点は紙の左上 */
export type Sheet = {
  width: number;
  height: number;
  shapes: Shape[];
};

export type StaffPaperFile = {
  fileName: string;
  bytes: Uint8Array<ArrayBuffer>;
};

/** 選んだ組み合わせの割り付けを出す */
export function drawSheet(paperId: PaperId, layoutId: LayoutId, titleField: boolean): Sheet {
  const paper = find(PAPERS, paperId);
  const layout: Layout = find(LAYOUTS, layoutId);
  const shapes: Shape[] = [];
  const columnWidth = paper.width / paper.columns;
  // タイトル欄は上の余白の下に取る。見開きでは左右の面の両方に取り、五線の高さを揃える
  const top = MARGIN.top + (titleField ? TITLE_FIELD.height : 0);
  for (let column = 0; column < paper.columns; column++) {
    const left = columnWidth * column + MARGIN.x;
    const right = columnWidth * (column + 1) - MARGIN.x;
    if (titleField) drawTitleLine(shapes, left, right);
    drawColumn(shapes, left, right, top, paper.height - MARGIN.bottom, layout);
  }
  return { width: paper.width, height: paper.height, shapes };
}

/** 選んだ組み合わせを画面に出す文字列。「A4・12 段・タイトル欄あり」 */
export function describeStaffPaper(
  paperId: PaperId,
  layoutId: LayoutId,
  titleField: boolean,
): string {
  const parts: string[] = [find(PAPERS, paperId).label, find(LAYOUTS, layoutId).label];
  if (titleField) parts.push("タイトル欄あり");
  return parts.join("・");
}

export function createStaffPaper(
  paperId: PaperId,
  layoutId: LayoutId,
  titleField: boolean,
): StaffPaperFile {
  const sheet = drawSheet(paperId, layoutId, titleField);
  const suffix = titleField ? "-title" : "";
  return {
    fileName: `staffpaper-${paperId}-${layoutId}${suffix}.pdf`,
    bytes: buildPdf({
      width: sheet.width * PT_PER_MM,
      height: sheet.height * PT_PER_MM,
      content: pdfContent(sheet),
      title: `Staff paper ${paperId} ${layoutId}${suffix}`,
    }),
  };
}

function find<T extends { id: string }>(items: readonly T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`unknown id: ${id}`);
  return item;
}

/** タイトルを書く欄の下線。面の中央に引く */
function drawTitleLine(shapes: Shape[], left: number, right: number): void {
  const center = (left + right) / 2;
  const half = TITLE_FIELD.lineLength / 2;
  const y = MARGIN.top + TITLE_FIELD.lineY;
  shapes.push({ kind: "line", from: [center - half, y], to: [center + half, y] });
}

function drawColumn(
  shapes: Shape[],
  left: number,
  right: number,
  top: number,
  bottom: number,
  layout: Layout,
): void {
  // 段（または組）ごとに同じ高さの枠を割り当て、その中央に置く。
  // こうすると段の間隔と上下の余白が揃う
  const pitch = (bottom - top) / layout.count;
  if (layout.kind === "single") {
    for (let i = 0; i < layout.count; i++) {
      const staffTop = top + pitch * i + (pitch - layout.staffHeight) / 2;
      drawStaff(shapes, left, right, staffTop, layout.staffHeight);
    }
    return;
  }
  const systemHeight = layout.staffHeight * 2 + layout.gap;
  for (let i = 0; i < layout.count; i++) {
    const staffTop = top + pitch * i + (pitch - systemHeight) / 2;
    const staffBottom = staffTop + systemHeight;
    drawStaff(shapes, left, right, staffTop, layout.staffHeight);
    drawStaff(shapes, left, right, staffBottom - layout.staffHeight, layout.staffHeight);
    // 2 段をつなぐ左端の縦線と波かっこ
    shapes.push({ kind: "line", from: [left, staffTop], to: [left, staffBottom] });
    drawBrace(shapes, left - 1, staffTop, staffBottom);
  }
}

/** top を最上線にして、5 本の線を等間隔に引く */
function drawStaff(
  shapes: Shape[],
  left: number,
  right: number,
  top: number,
  height: number,
): void {
  for (let i = 0; i < 5; i++) {
    const y = top + (height * i) / 4;
    shapes.push({ kind: "line", from: [left, y], to: [right, y] });
  }
}

/** 大譜表の波かっこ。x は波かっこの右端 */
function drawBrace(shapes: Shape[], x: number, top: number, bottom: number): void {
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
    const p = (dx: number, dy: number): Point => [x + dx, end + sign * dy];
    shapes.push({
      kind: "fill",
      start: p(0, 0),
      curves: [
        [p(-0.9 * width, 0.12 * half), p(-0.1 * width, 0.88 * half), p(-width, half)],
        [
          p(-0.1 * width + thickness, 0.88 * half),
          p(-0.9 * width + thickness, 0.12 * half),
          p(0, 0),
        ],
      ],
    });
  }
}

/** mm・上端原点の図形を、PDF の描画命令（pt・下端原点）にする */
function pdfContent(sheet: Sheet): string {
  const point = ([x, y]: Point): string =>
    `${num(x * PT_PER_MM)} ${num((sheet.height - y) * PT_PER_MM)}`;
  const ops = sheet.shapes.map((shape) => {
    if (shape.kind === "line") return `${point(shape.from)} m ${point(shape.to)} l S`;
    const segments = shape.curves.map((curve) => `${curve.map(point).join(" ")} c`);
    return `${point(shape.start)} m ${segments.join(" ")} f`;
  });
  return [`${LINE_WIDTH} w`, "0 g 0 G", ...ops].join("\n");
}
