import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Vite が出力の先頭に差し込む modulepreload のポリフィルは Vite の MIT コードで、
    // 配るなら著作権表示が要る。モジュールは 1 本だけでプリロードも使わず、対応していない
    // ブラウザでも困らないので、第三者のコードを配布物に入れないために切る。
    modulePreload: { polyfill: false },
  },
});
