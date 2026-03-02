import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: [{ find: "@", replacement: path.resolve(__dirname, "src") }],
	},
	test: {
		environment: "node",
		include: ["tests/integration/**/*.test.ts"],
		setupFiles: ["tests/integration/setup.ts"],
		fileParallelism: false,
	},
});
