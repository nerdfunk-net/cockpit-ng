import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import noInlineDefaults from './eslint-rules/no-inline-defaults.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      'react-hooks': reactHooksPlugin,
      'custom-rules': {
        rules: {
          'no-inline-defaults': noInlineDefaults,
        },
      },
    },
    rules: {
      // Enforce exhaustive dependencies in useEffect, useMemo, useCallback
      'react-hooks/exhaustive-deps': 'error',

      // Warn about missing dependencies (should be error in production)
      'react-hooks/rules-of-hooks': 'error',

      // Disable setState-in-effect rule - valid pattern for syncing server data to local form state
      'react-hooks/set-state-in-effect': 'off',

      // Custom rule: Prevent inline default parameters
      'custom-rules/no-inline-defaults': 'error',

      // TypeScript rules for better type safety
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // React best practices
      'react/jsx-key': 'error',
      'react/no-array-index-key': 'warn',
      
      // Prevent common bugs
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'dist/**',
      '.turbo/**',
      'coverage/**',
    ],
  },
];

export default eslintConfig;
