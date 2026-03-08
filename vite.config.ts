import { builtinModules } from "node:module";
import path from "node:path";

import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const pluginId = "josh-personal-plugin";
const vaultPath = "/Users/work/josh";
const vaultPluginDirectory = path.join(vaultPath, ".obsidian", "plugins", pluginId);
const external = [
  "obsidian",
  "electron",
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
];

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "styles.css", dest: "." },
      ],
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    outDir: vaultPluginDirectory,
    emptyOutDir: true,
    sourcemap: "inline",
    minify: false,
    rollupOptions: {
      external,
      output: {
        exports: "default",
      },
    },
  },
});
