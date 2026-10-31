import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default defineConfig([
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": hooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...hooks.configs.recommended.rules,
    },
  },
  { files: ["**/*.mjs"], languageOptions: { globals: { process: "readonly" } } },
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "output/**",
  ]),
]);
