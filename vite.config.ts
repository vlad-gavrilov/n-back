import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { license: { fileName: 'licenses/dependencies.md' } },
  preview: {
    headers: process.env.NBACK_E2E_RUN_ID ? { 'X-Nback-Preview': process.env.NBACK_E2E_RUN_ID } : {},
  },
  test: { include: ['src/**/*.test.ts'] },
})
