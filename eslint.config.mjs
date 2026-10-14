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
