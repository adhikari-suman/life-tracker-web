/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The generated client calls /v1/... by default (see src/api/runtimeConfig.ts). Proxying in
    // dev keeps the app same-origin with the API, so there is no CORS config to keep in step
    // with the backend and no preflight on every request. Override the target with
    // VITE_BACKEND_ORIGIN if the backend is not on 8080.
    proxy: {
      '/v1': {
        target: process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The generated client is not ours to test, and it is regenerated on every run.
    exclude: ['node_modules/**', 'dist/**', 'src/api/generated/**'],
  },
})
