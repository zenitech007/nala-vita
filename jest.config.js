/** @type {import('jest').Config} */
const config = {
  projects: [
    // ── Node environment: API routes, lib utilities ──────
    {
      displayName: "node",
      testEnvironment: "node",
      testMatch: [
        "**/__tests__/**/*.node.test.ts",
        "**/__tests__/api/**/*.test.ts",
        "**/__tests__/lib/**/*.test.ts",
      ],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { diagnostics: false, tsconfig: "tsconfig.test.json" }],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      modulePathIgnorePatterns: ["<rootDir>/.next/"],
    },
    // ── jsdom environment: React components ─────────────
    {
      displayName: "jsdom",
      testEnvironment: "jsdom",
      testMatch: ["**/__tests__/components/**/*.test.tsx"],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      setupFilesAfterEnv: ["@testing-library/jest-dom"],
    },
  ],
};

module.exports = config;
