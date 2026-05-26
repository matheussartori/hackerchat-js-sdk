import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@matheussartori/hackerchat-js-sdk/react': resolve(__dirname, '../src/react/index.ts'),
      '@matheussartori/hackerchat-js-sdk': resolve(__dirname, '../src/index.ts'),
    },
  },
  server: { port: 5173 },
})
