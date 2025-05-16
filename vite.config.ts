import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      stream: 'stream-browserify',
      buffer: 'buffer',
      util: 'util',
      process: 'process/browser',
    }
  },
  define: {
    'process.env': {},
    'global': 'globalThis',
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: ['utf-8-validate', 'bufferutil']
    }
  },
  optimizeDeps: {
    include: ['buffer', 'process/browser'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
})
