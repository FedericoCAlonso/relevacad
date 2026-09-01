import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/relevacad/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'RelevaCAD - Relevamiento Arquitectónico y Eléctrico',
        short_name: 'RelevaCAD',
        description: 'PWA profesional para relevamiento topológico, parametrización métrica y ensamblaje 2D de instalaciones eléctricas según AEA 90364-771.',
        theme_color: '#1976d2',
        background_color: '#f8f9fa',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: '/relevacad/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/relevacad/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
