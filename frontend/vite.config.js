import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'LegalLens AI Scanner',
        short_name: 'LegalLens',
        description: 'SIH26034 Legal Metrology Auditor',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3524/3524335.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3524/3524335.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  // This ensures Tesseract.js WebAssembly files load properly on Vercel
  optimizeDeps: {
    exclude: ['tesseract.js']
  }
});
