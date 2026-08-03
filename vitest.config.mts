import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "playwright/**",
        "src/lib/supabase/database.types.ts",
        "**/*.config.*",
      ],
    },
    // Integration tests are always discovered but self-skip at runtime via
    // RUN_SUPABASE_INTEGRATION_TESTS (see src/test/integration/) so `pnpm test`
    // stays hermetic without needing a separate Vitest config.
    exclude: ["node_modules/**", ".next/**", "playwright/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
