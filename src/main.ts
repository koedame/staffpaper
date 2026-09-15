import { renderSheet } from "./preview.ts";
import {
  createStaffPaper,
  describeStaffPaper,
  drawSheet,
  LAYOUTS,
  type LayoutId,
  PAPERS,
  type PaperId,
} from "./staff-paper.ts";

const DEFAULT_PAPER: PaperId = "A4";
const DEFAULT_LAYOUT: LayoutId = "12staves";
/** タイトル欄の選択肢。値は「欄を取るか」なので、画面の外には持ち出さない */
const TITLE_FIELDS = [
  { value: "none", label: "なし" },
  { value: "title", label: "あり" },
] as const;
const DEFAULT_TITLE_FIELD = "none";

const form = element("form", HTMLFormElement);
const sheet = element("sheet", SVGSVGElement);
const summary = element("summary", HTMLElement);

element("paper-options", HTMLElement).append(
  ...PAPERS.map((paper) => option("paper", paper.id, paper.label, paper.id === DEFAULT_PAPER)),
);
element("layout-options", HTMLElement).append(
  ...LAYOUTS.map((layout) =>
    option(
      "layout",
      layout.id,
      layout.label,
      layout.id === DEFAULT_LAYOUT,
      layout.kind === "grand",
    ),
  ),
);
element("title-options", HTMLElement).append(
  ...TITLE_FIELDS.map((field) =>
    option("title", field.value, field.label, field.value === DEFAULT_TITLE_FIELD),
  ),
);

form.addEventListener("change", showPreview);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const { paperId, layoutId, titleField } = selection();
  const file = createStaffPaper(paperId, layoutId, titleField);
  const url = URL.createObjectURL(new Blob([file.bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  // Safari はダウンロードの確認を出してから URL を読みにいくので、すぐには無効にしない
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
});

showPreview();

function showPreview(): void {
  const { paperId, layoutId, titleField } = selection();
  renderSheet(sheet, drawSheet(paperId, layoutId, titleField));
  // プレビューの中身は figcaption が言葉で言い直しているので、読み上げには出さない
  summary.textContent = describeStaffPaper(paperId, layoutId, titleField);
}

function selection(): { paperId: PaperId; layoutId: LayoutId; titleField: boolean } {
  const chosen = new FormData(form);
  // 選択肢は PAPERS / LAYOUTS / TITLE_FIELDS から作っているので、値は必ずそのどれかになる
  return {
    paperId: String(chosen.get("paper")) as PaperId,
    layoutId: String(chosen.get("layout")) as LayoutId,
    titleField: chosen.get("title") === "title",
  };
}

/** 押すと 1 回で選べる選択肢。中身はラジオボタンなので、キーボードでも矢印で選べる */
function option(
  name: string,
  value: string,
  label: string,
  checked: boolean,
  wide = false,
): HTMLLabelElement {
  const option = document.createElement("label");
  option.className = wide ? "option option--wide" : "option";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  const text = document.createElement("span");
  text.textContent = label;
  option.append(input, text);
  return option;
}

function element<T extends Element>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`#${id} is missing`);
  return found;
}
