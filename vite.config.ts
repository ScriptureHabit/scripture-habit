/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || "",
      project: process.env.SENTRY_PROJECT || "react", 
      authToken: process.env.SENTRY_AUTH_TOKEN || "",
      telemetry: false,
    }),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: null,
      devOptions: {
        enabled: process.env.VITE_ENABLE_SW_IN_DEV === 'true',
        type: 'module',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json}'],
        globIgnores: [
          '**/index-es.html',
          '**/index-pt.html',
          '**/index-zho.html',
          '**/index-vi.html',
          '**/index-th.html',
          '**/index-ko.html',
          '**/index-tl.html',
          '**/index-sw.html',
          '**/index-it.html',
          '**/assets/{es,pt,zho,vi,th,ko,tl,sw,it}-*.js',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false,
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  } as any,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setup-tests.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/**'],
    fileParallelism: true,
    testTimeout: 5000,
    hookTimeout: 5000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    exclude: ['node_modules/', 'src/setup-tests.ts', 'tests/**']
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/analytics',
      'axios',
      'react-toastify',
      'react-router-dom',
      'zustand',
      '@sentry/react'
    ]
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress eval warnings from vconsole
        if (warning.code === 'EVAL' && warning.id?.includes('vconsole')) {
          return;
        }
        warn(warning);
      },
      output: {
        manualChunks(id) {
          // Only split external third-party packages from node_modules
          if (!id.includes('node_modules')) return;

          // 1. Diagnostics & Standalone tools
          if (id.includes('vconsole')) return 'vconsole';
          if (id.includes('@sentry')) return 'vendor-sentry';
          if (id.includes('canvas-confetti')) return 'vendor-confetti';

          // 2. UI Icons & Markdown rendering pipeline
          if (id.includes('@iconscout') || id.includes('lucide-react')) return 'vendor-icons';
          if (['micromark', 'mdast', 'remark', 'unist', 'hast', 'property-information'].some(pkg => id.includes(pkg))) {
            return 'vendor-markdown';
          }

          // 3. Firebase SDKs (Specific subsystems first, then general core)
          if (id.includes('@firebase/storage') || id.includes('firebase/storage')) return 'vendor-firebase-storage';
          if (id.includes('@firebase/messaging') || id.includes('firebase/messaging')) return 'vendor-firebase-messaging';
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) return 'vendor-firebase-firestore';
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) return 'vendor-firebase-auth';
          if (id.includes('firebase')) return 'vendor-firebase';

          // 4. React runtime & Routing ecosystem
          if (['react-dom', '/react/', 'scheduler', 'react-router'].some(pkg => id.includes(pkg))) {
            return 'vendor-react';
          }

          // 5. Data Fetching, State & UI Utilities (granular chunks to prevent Long Tasks)
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('react-toastify')) return 'vendor-toastify';
          if (id.includes('axios')) return 'vendor-axios';
          if (id.includes('date-fns')) return 'vendor-date-fns';
          if (id.includes('react-select')) return 'vendor-select';
          if (id.includes('zod')) return 'vendor-zod';

          return 'vendor-others';
        },
      },
    },
  },
}))
