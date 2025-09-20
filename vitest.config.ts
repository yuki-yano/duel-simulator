import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  test: {
    // ==================== 基本設定 ====================
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],

    // ==================== カバレッジ設定 ====================
    coverage: {
      enabled: process.env.COVERAGE === 'true',
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      all: true,
      include: [
        'src/client/**/*.{ts,tsx}',
        'src/server/**/*.ts',
        'src/shared/**/*.ts'
      ],
      exclude: [
        'node_modules',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/**/index.ts',
        'src/**/*.stories.tsx',
        'src/client/sw.ts', // Service Worker
        'src/server/db/migrations/**' // Migration files
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70
      }
    },

    // ==================== テスト実行設定 ====================
    include: [
      'src/**/*.{test,spec}.{ts,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache'
    ],

    // ==================== タイムアウト・リトライ設定 ====================
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    retry: process.env.CI === 'true' ? 2 : 0,

    // ==================== 並列実行設定 ====================
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: process.env.CI === 'true' ? 2 : undefined,
        minThreads: 1,
      }
    },
    isolate: true,

    // ==================== レポーター設定 ====================
    reporters: process.env.CI === 'true'
      ? ['default', 'junit', 'json']
      : ['default'],

    outputFile: process.env.CI === 'true' ? {
      junit: './test-results/junit.xml',
      json: './test-results/results.json'
    } : undefined,

    // ==================== モック設定 ====================
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // ==================== 監視モード設定 ====================
    watch: false,

    // ==================== スナップショット設定 ====================
    snapshotFormat: {
      printBasicPrototype: false
    },
    resolveSnapshotPath: (path, extension) => {
      return path.replace(/\.test\.(ts|tsx)/, `.test${extension}`)
    }
  },

  // ==================== エイリアス設定 ====================
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@client': path.resolve(__dirname, './src/client'),
      '@server': path.resolve(__dirname, './src/server'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@test': path.resolve(__dirname, './src/test')
    }
  }
})
