import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/",
  resolve: {
    alias: {
      "@domain": resolve(import.meta.dirname!, "src/domain"),
      "@application": resolve(import.meta.dirname!, "src/application"),
      "@infrastructure": resolve(import.meta.dirname!, "src/infrastructure"),
      "@presentation": resolve(import.meta.dirname!, "src/presentation"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
