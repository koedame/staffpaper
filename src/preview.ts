// 画面のプレビュー。PDF と同じ Sheet を SVG にするので、見えている形が PDF の中身と一致する。
// 座標は mm のまま viewBox に載せ、拡大率は CSS（用紙の幅と高さの比）に任せる。

import type { Point, Sheet } from "./staff-paper.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

/** 五線と波かっこの d 属性。空なら引くものが無い */
export function sheetPaths(sheet: Sheet): { staves: string; braces: string } {
  const staves: string[] = [];
  const braces: string[] = [];
  for (const shape of sheet.shapes) {
    if (shape.kind === "line") {
      staves.push(`M ${point(shape.from)} L ${point(shape.to)}`);
      continue;
    }
    const curves = shape.curves.map((curve) => `C ${curve.map(point).join(" ")}`);
    braces.push(`M ${point(shape.start)} ${curves.join(" ")} Z`);
  }
  return { staves: staves.join(" "), braces: braces.join(" ") };
}

/** 用紙 1 枚を svg に描き直す。用紙の縦横比は CSS 変数で渡す */
export function renderSheet(svg: SVGSVGElement, sheet: Sheet): void {
  svg.setAttribute("viewBox", `0 0 ${sheet.width} ${sheet.height}`);
  svg.style.setProperty("--sheet-width", String(sheet.width));
  svg.style.setProperty("--sheet-height", String(sheet.height));
  const { staves, braces } = sheetPaths(sheet);
  svg.replaceChildren(path("staves", staves), path("braces", braces));
}

function path(className: string, d: string): SVGPathElement {
  const element = document.createElementNS(SVG_NS, "path");
  element.setAttribute("class", className);
  element.setAttribute("d", d);
  return element;
}

function point([x, y]: Point): string {
  return `${round(x)} ${round(y)}`;
}

/** 0.01mm より細かい差は紙の上では見えないので、そこで丸める */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
