import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Domain boundary: src/domain stays pure (no React, Next, stores or app layers).
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react-dom",
            "react/*",
            "next",
            "next/*",
            "zustand",
            "zustand/*",
            "@/components/*",
            "@/stores/*",
            "@/features/*",
            "@/lib/*",
          ],
        },
      ],
    },
  },
  // Server boundary (ACC-04): browser-side code can never pull the server modules in.
  // The domain block above keeps its own list; tests may import the route and the server modules.
  {
    files: [
      "src/features/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/stores/**/*.{ts,tsx}",
      "src/lib/client/**/*.{ts,tsx}",
      "src/lib/copy/**/*.{ts,tsx}",
    ],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@/lib/server/*", "**/lib/server/*", "server-only"],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tooling and planning artifacts that are not application source.
    ".claude/**",
    ".planning/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
