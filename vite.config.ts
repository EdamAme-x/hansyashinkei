import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname!, "package.json"), "utf-8"));

export default defineConfig({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@domain": resolve(import.meta.dirname!, "src/domain"),
      "@application": resolve(import.meta.dirname!, "src/application"),
      "@infrastructure": resolve(import.meta.dirname!, "src/infrastructure"),
      "@presentation": resolve(import.meta.dirname!, "src/presentation"),
      "@shared": resolve(import.meta.dirname!, "src/shared"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/pako") || id.includes("node_modules/cbor")) return "vendor";
        },
      },
    },
  },
});
