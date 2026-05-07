import { nodeLibrary } from "@axel-saas/eslint-config/node-library";

export default [
  // dist/ is the bun-bundled plugin entry — not source. Skip it so the
  // bundler's preserved Node globals (AbortController, setTimeout,
  // Buffer, URL) don't trip the strict source-code lint config.
  { ignores: ["dist/**"] },
  ...nodeLibrary(import.meta.dirname),
];
