import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: ['89184b2f1f59.ngrok-free.app']
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        simulator: resolve(__dirname, 'simulator.html'),
      },
    },
  },
  test: {
    environment: 'node', // Default to node for simulator tests
    setupFiles: './src/test/setup.ts',
    server: {
      deps: {
        inline: ['@testing-library/react', '@testing-library/jest-dom'],
      },
    },
  },
})
