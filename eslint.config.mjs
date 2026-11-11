import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  { files: ["jest.config.js", "jest.setup.jsdom.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  globalIgnores([
    ".next/**", ".vercel/**", ".amelia-source/**", "out/**", "build/**",
    "coverage/**", "graphify-out/**", ".archive/**",
    "Searches/**", "next-env.d.ts",
  ]),
]);
