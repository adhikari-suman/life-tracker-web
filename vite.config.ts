/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The generated client calls /v1/... by default (see src/api/runtimeConfig.ts).
    //
    // The proxy is REQUIRED, not a convenience. life-tracker-backend has no CORS configuration —
    // no CorsConfigurationSource, nothing in SecurityConfig — so a browser calling
    // http://localhost:8080/v1 directly from this origin fails at preflight. Proxying keeps
    // every call same-origin, which is why nothing has to be added to the backend to develop
    // against it.
    //
    // The target comes from life-tracker-backend/compose.yaml, which publishes the app service
    // on "8080:8080"; the dependencies-only mode binds the same port from `bootRun`. Override
    // with VITE_BACKEND_ORIGIN if it is somewhere else.
    proxy: {
      '/v1': {
        target: process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8080',
        changeOrigin: true,
        // NOTE: no rewrite, deliberately. /v1 is the backend's own context-path
        // (server.servlet.context-path in application.properties, ADR-0017) rather than a
        // prefix a gateway strips, so /v1/auth/login here is /v1/auth/login there. Stripping it
        // would produce a 404 on every request.
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
