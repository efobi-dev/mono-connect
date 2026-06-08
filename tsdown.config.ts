import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	sourcemap: false,
	clean: true,
	treeshake: true,
	target: "esnext",
	outDir: "dist",
});
