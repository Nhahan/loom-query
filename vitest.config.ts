import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vitest/config";

// Strip "use client" / "use server" directives so @vitejs/plugin-react
// does not treat them as RSC boundaries and proxy the module as empty.
function stripClientDirectives(): Plugin {
  return {
    name: "strip-client-directives",
    enforce: "pre",
    transform(code: string, id: string) {
      if (!id.endsWith(".tsx") && !id.endsWith(".ts") && !id.endsWith(".jsx") && !id.endsWith(".js")) return;
      const stripped = code.replace(/^\s*["']use client["'];?\s*\n?/, "");
      if (stripped !== code) return { code: stripped, map: null };
    },
  };
}

export default defineConfig({
  plugins: [stripClientDirectives(), tsconfigPaths(), react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    passWithNoTests: true,
  },
});
