import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: { manualChunks: { three: ['three'] } },
    },
  },
  server: { port: 5173, open: false },
  test: { include: ['src/**/*.test.ts'] },
});
