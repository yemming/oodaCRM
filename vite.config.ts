import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: 'dist',
    target: 'esnext',
    assetsInlineLimit: 100000000, // Force inline all assets
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        // Note: manualChunks is incompatible with inlineDynamicImports
        // viteSingleFile plugin handles the final bundling
      },
    },
  },
});
