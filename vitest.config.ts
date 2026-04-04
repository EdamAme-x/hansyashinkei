import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { cpus } from "node:os";

export default defineConfig({
  resolve: {
    alias: {
      "@domain": resolve(import.meta.dirname!, "src/domain"),
      "@application": resolve(import.meta.dirname!, "src/application"),
      "@infrastructure": resolve(import.meta.dirname!, "src/infrastructure"),
      "@presentation": resolve(import.meta.dirname!, "src/presentation"),
    },
  },
  test: {
    environment: "node",
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: Math.max(1, Math.floor(cpus().length * 0.75)),
      },
    },
  },
});
