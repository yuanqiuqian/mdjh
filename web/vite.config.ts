import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from 'vite-plugin-pwa'

const manualChunks = (id: string) => {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    id.includes("react-hook-form") ||
    id.includes("@hookform/resolvers") ||
    id.includes("/zod/")
  ) {
    return "form-vendor";
  }

  if (
    id.includes("/react/") ||
    id.includes("react-dom") ||
    id.includes("react-router-dom")
  ) {
    return "react-vendor";
  }

  if (id.includes("zustand") || id.includes("/idb/")) {
    return "data-vendor";
  }

  return undefined;
};

export default defineConfig({
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '名动江湖',
        short_name: '江湖',
        description: '武侠江湖对话型文字游戏（支持 PWA 与离线修行）',
        theme_color: '#050505',
        background_color: '#050505',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
    tsconfigPaths()
  ],
})
