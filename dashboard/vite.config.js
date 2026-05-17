import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/dashboard/',
  build: {
    outDir: '../public/dashboard',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              test: /node_modules\/(react|react-dom)\//,
              name: 'vendor',
            },
            {
              test: /node_modules\/react-router-dom\//,
              name: 'router',
            },
            {
              test: /node_modules\/socket.io-client\//,
              name: 'socket',
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
