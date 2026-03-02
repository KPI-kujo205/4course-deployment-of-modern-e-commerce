import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      { find: "@core", replacement: path.resolve(__dirname, "src/core") },
      { find: "@infra", replacement: path.resolve(__dirname, "src/infra") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
