import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      '**/*.config.{ts,js}',
      'src/hooks/shared/device-selector/use-device-preview.test.ts', // Temporarily skip - memory issue
    ],
    pool: 'forks',
    fileParallelism: false,
    // Timeout settings (in milliseconds)
    testTimeout: 10000,       // 10s per test (default: 5s)
    hookTimeout: 10000,       // 10s for beforeEach/afterEach
    teardownTimeout: 10000,   // 10s for cleanup
    // Test validation
    passWithNoTests: false,   // Fail if no tests found (catch typos in test patterns)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.setup.ts',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        '**/types/**',
        'src/components/ui/**', // Shadcn components
      ],
    },
  },
})
