import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  outDir: "dist",
  splitting: false,
  // Externalize workspace dependencies so they are not bundled
  external: ["@aptos-labs/ts-sdk", "@cash/shared"],
});
