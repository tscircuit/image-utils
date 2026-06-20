import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "index.ts",
    "looks-same": "lib/looks-same.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  target: "esnext",
  clean: true,
})
