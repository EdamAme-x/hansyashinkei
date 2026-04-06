import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@domain": resolve(import.meta.dirname!, "src/domain"),
      "@application": resolve(import.meta.dirname!, "src/application"),
      "@infrastructure": resolve(import.meta.dirname!, "src/infrastructure"),
      "@presentation": resolve(import.meta.dirname!, "src/presentation"),
      "@shared": resolve(import.meta.dirname!, "src/shared"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
