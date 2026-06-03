import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import tseslint from 'typescript-eslint'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import noInlineDefaults from './eslint-rules/no-inline-defaults.mjs'

const eslintConfig = [
  ...nextCoreWebVitals,
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

      // React best practices
      'react/jsx-key': 'error',
      'react/no-array-index-key': 'warn',

      // Prevent common bugs
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
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
      'public/**',
      'next-env.d.ts',
    ],
  },
]

export default eslintConfig
