import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Prevent bundling Node built-ins for browser
      fs: false,
      path: false,
      vm: false,
    },
  },
  optimizeDeps: {
    exclude: ['fs', 'path', 'vm'],
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
