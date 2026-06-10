import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the built game can be opened from any static host or folder
  base: './',
  server: {
    // honor the port assigned by the preview/launch harness
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    // listen on all interfaces so tablets/laptops on the home network can play
    host: true,
  },
});
