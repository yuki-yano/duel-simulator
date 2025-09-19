import eslint from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import pluginReactJSXRuntime from "eslint-plugin-react/configs/jsx-runtime.js"
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js"
import pluginReactHooks from "eslint-plugin-react-hooks"
import globals from "globals"
import tseslint from "typescript-eslint"

export default [
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.esnext,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReactConfig,
  pluginReactJSXRuntime,
  eslintConfigPrettier,
  {
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      eqeqeq: ["error", "smart"],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
    },
  },
  {
    ignores: ["**/*.js", "**/*.mjs", "vite.config.ts", "dist", "node_modules", ".wrangler", "docs"],
  },
]
