import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: {
      APP_MODE: "local-admin",
      ADMIN_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "https://nfc.example.com",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable",
      SUPABASE_SECRET_KEY: "test-secret",
      SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
      ADMIN_EMAILS: "owner@example.com",
    },
  },
});
