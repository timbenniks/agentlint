import { defineConfig } from "tsup";

const shared = {
  format: ["esm"] as const,
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node22" as const,
};

export default defineConfig([
  {
    ...shared,
    entry: { "cli/index": "src/cli/index.ts" },
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    ...shared,
    clean: false,
    entry: { index: "src/index.ts" },
  },
]);
