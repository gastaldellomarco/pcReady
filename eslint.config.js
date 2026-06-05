import js from "@eslint/js";
import globals from "globals";
import jsdoc from "eslint-plugin-jsdoc";
import perfectionist from "eslint-plugin-perfectionist";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactPlugin from "eslint-plugin-react";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "dist/**",
      ".output/**",
      ".vinxi/**",
      "coverage/**",
      ".venv/**",
      "**/.venv/**",
      "**/*.venv/**",
      "src/integrations/supabase/types.ts",
      "src/routeTree.gen.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      react: reactPlugin,
      perfectionist,
      jsdoc,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/display-name": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "no-unused-vars": "off",
      "linebreak-style": ["error", "unix"],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Forza l'uso dell'alias @/ per tutti gli import interni
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../**"],
              message: "Usa l'alias @/ invece di import relativi che superano un livello (../).",
            },
            {
              group: ["src/**"],
              message:
                "Usa l'alias @/ invece del percorso assoluto 'src/'. Esempio: '@/' al posto di 'src/'",
            },
          ],
        },
      ],
      // Ordina automaticamente gli import
      "perfectionist/sort-imports": [
        "warn",
        {
          type: "natural",
          order: "asc",
          groups: [
            "side-effect",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "style",
            "type",
          ],
          internalPattern: ["^@/.*", "^@root/.*"],
          newlinesBetween: "ignore",
        },
      ],
      // ── JSDoc (documentazione obbligatoria su tipi e funzioni esportati) ──────
      // require-jsdoc: solo item esportati (ESM + CJS) necessitano JSDoc.
      // I tipi TypeScript (type/interface/enum) sono coperti via `contexts`
      // con selettori ESTree perché il plugin non supporta TSInterfaceDeclaration
      // e simili direttamente nel `require`.
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: { cjs: true, esm: true },
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            MethodDefinition: true,
          },
          contexts: [
            'TSInterfaceDeclaration[parent.type="ExportNamedDeclaration"]',
            'TSTypeAliasDeclaration[parent.type="ExportNamedDeclaration"]',
            'TSEnumDeclaration[parent.type="ExportNamedDeclaration"]',
          ],
        },
      ],
      // TODO: abilitare gradualmente — richiedono @param/@returns su TUTTE le funzioni
      // (non solo quelle esportate), quindi generano molto rumore inizialmente.
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-property": "off",
      // Incremental: tighten after reducing `any` in these trees (see #58).
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "src/lib/**/*.{ts,tsx}",
      "src/routes/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/__tests__/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
