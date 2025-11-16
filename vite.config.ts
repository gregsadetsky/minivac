import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: ['425bfcdecd85.ngrok-free.app']
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
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
