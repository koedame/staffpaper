// 画面の見た目を実ブラウザで撮る。ui.pen の各画面と同じ大きさ・同じ選択で並べて見比べる。
//   pnpm build && pnpm screenshot   # screenshots/ に PNG が出る
//
// 見た目・レイアウト・実寸はユニットテストでは測れないので、変更したらここで撮って目で見る。
//
// 本番と同じ dist/_headers（CSP など）を付けて配り、各画面で PDF のダウンロードまで押す。
// CSP の違反・コンソールのエラー・ダウンロードの失敗が 1 つでもあれば exit 1 で終わる。

import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const OUT = fileURLToPath(new URL("../screenshots/", import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

const PC = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 934 };

/** dist/_headers の `/*` の節（全レスポンスに付けるヘッダ）を [名前, 値] の並びにする */
async function rootHeaders() {
  const lines = (await readFile(join(DIST, "_headers"), "utf8")).split("\n");
  const start = lines.indexOf("/*");
  if (start < 0) throw new Error("dist/_headers に /* の節が無い");
  const headers = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(line)) break;
    const at = line.indexOf(":");
    headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
  }
  return headers;
}

const SCREENS = [
  {
    name: "pc-a4-12staves-title",
    viewport: PC,
    colorScheme: "light",
    choose: ["A4", "12 段", "あり"],
  },
  {
    name: "pc-a3-grand-staff",
    viewport: PC,
    colorScheme: "light",
    choose: ["A3（A4 見開き）", "大譜表 6 組", "なし"],
  },
  {
    name: "mobile-a4-12staves-title",
    viewport: MOBILE,
    colorScheme: "light",
    choose: ["A4", "12 段", "あり"],
  },
  {
    name: "mobile-a3-16staves-title",
    viewport: MOBILE,
    colorScheme: "light",
    choose: ["A3（A4 見開き）", "16 段", "あり"],
  },
  {
    name: "mobile-dark-a4-8staves",
    viewport: MOBILE,
    colorScheme: "dark",
    choose: ["A4", "8 段", "なし"],
  },
];

const HEADERS = await rootHeaders();

const server = createServer(async (request, response) => {
  const path = (request.url ?? "/").split("?")[0];
  const file = join(DIST, path === "/" ? "index.html" : path);
  if (!file.startsWith(DIST)) return void response.writeHead(403).end("forbidden");
  try {
    const body = await readFile(file);
    response.writeHead(200, [
      ...HEADERS,
      ["content-type", TYPES[extname(file)] ?? "application/octet-stream"],
    ]);
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
});

await mkdir(OUT, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const browser = await chromium.launch();
const problems = [];

for (const screen of SCREENS) {
  const page = await browser.newPage({
    viewport: screen.viewport,
    colorScheme: screen.colorScheme,
    deviceScaleFactor: 2,
    acceptDownloads: true,
  });
  // CSP の違反は、読み込みを止められたものも実行時に弾かれたものも、このイベントで拾える
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(`CSP 違反: ${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`${screen.name}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`${screen.name}: ${error.message}`));
  await page.goto(`http://127.0.0.1:${port}/`);
  for (const label of screen.choose) {
    await page.getByRole("radio", { name: label, exact: true }).check({ force: true });
  }
  await page.screenshot({ path: join(OUT, `${screen.name}.png`) });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PDF をダウンロード" }).click(),
  ]);
  const pdf = await readFile(await download.path());
  if (pdf.subarray(0, 5).toString() !== "%PDF-") {
    problems.push(`${screen.name}: ${download.suggestedFilename()} が PDF になっていない`);
  }
  console.log(`${screen.name}.png  ${download.suggestedFilename()} (${pdf.length} bytes)`);
  await page.close();
}

await browser.close();
server.close();

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
