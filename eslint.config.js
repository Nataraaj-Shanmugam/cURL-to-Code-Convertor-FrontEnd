import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { 
        sourceType: "module", 
        ecmaFeatures: { jsx: true } 
      }
    },
    plugins: { 
      react, 
      "react-hooks": reactHooks 
    },
    rules: {
      // React
      "react/react-in-jsx-scope": "off",
      
      // React Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      
      // TypeScript - use @typescript-eslint rules instead
      "@typescript-eslint/no-unused-vars": [
        "warn", 
        { 
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      
      // Turn off conflicting base rule
      "no-unused-vars": "off"
    },
    settings: { 
      react: { version: "detect" } 
    }
  }
];