// 1 ページだけの PDF を、外部ライブラリを使わずに組み立てる。
// 描画命令（content stream）は呼び出し側が作り、ここは PDF のファイル構造だけを受け持つ。

export type PdfPage = {
  /** ページの幅（pt） */
  width: number;
  /** ページの高さ（pt） */
  height: number;
  /** content stream の中身。ASCII だけで書く */
  content: string;
  /** 文書のタイトル。ASCII だけで書く */
  title: string;
};

const encoder = new TextEncoder();

export function buildPdf(page: PdfPage): Uint8Array<ArrayBuffer> {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] /Resources << >> /Contents 4 0 R >>`,
    `<< /Length ${encoder.encode(page.content).length} >>\nstream\n${page.content}\nendstream`,
    `<< /Title (${escapeString(page.title)}) >>`,
  ];

  // xref にはバイト単位の位置を書くので、文字列ではなくバイト数で数える
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(encoder.encode(out).length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = encoder.encode(out).length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\n`;
  out += `startxref\n${xref}\n%%EOF\n`;
  return encoder.encode(out);
}

/** PDF の数値として書く。小数は 2 桁に丸める */
export function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function escapeString(text: string): string {
  return text.replace(/[\\()]/g, (c) => `\\${c}`);
}
