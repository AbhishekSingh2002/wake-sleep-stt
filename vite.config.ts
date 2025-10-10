import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl() // Enable HTTPS for local development (required for microphone access on some browsers)
  ],
  server: {
    port: 3000,
    https: true,
    open: true
  },
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    rollupOptions: {
      input: 'demo/index.html'
    }
  }
});
