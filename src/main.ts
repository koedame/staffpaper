import { createStaffPaper, LAYOUTS, type LayoutId, PAPERS, type PaperId } from "./staff-paper.ts";

const DEFAULT_LAYOUT: LayoutId = "12staves";

const form = element("form", HTMLFormElement);
const paperSelect = element("paper", HTMLSelectElement);
const layoutSelect = element("layout", HTMLSelectElement);

for (const paper of PAPERS) paperSelect.add(new Option(paper.label, paper.id));
for (const layout of LAYOUTS) {
  layoutSelect.add(new Option(layout.label, layout.id, false, layout.id === DEFAULT_LAYOUT));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  // 選択肢は PAPERS / LAYOUTS から作っているので、値は必ずどちらかの id になる
  const file = createStaffPaper(paperSelect.value as PaperId, layoutSelect.value as LayoutId);
  const url = URL.createObjectURL(new Blob([file.bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  // Safari はダウンロードの確認を出してから URL を読みにいくので、すぐには無効にしない
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
});

function element<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`#${id} is missing`);
  return found;
}
