/// <reference types="vitest/config" />
import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Strict CSP for production builds only (the dev server needs inline scripts for HMR).
// React style props go through CSSOM, so inline styles need no 'unsafe-inline'.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://i.ytimg.com https://oer.upou.edu.ph",
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
  "connect-src 'self'",
  "font-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const cspPlugin = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
      injectTo: 'head-prepend',
    },
  ],
})

// GitHub Pages has no rewrites; it serves 404.html for unknown paths, so deep links still boot the app.
const spaFallbackPlugin = (): Plugin => {
  let outDir = 'dist'
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle: () => copyFile(resolve(outDir, 'index.html'), resolve(outDir, '404.html')),
  }
}

export default defineConfig({
  // "/<repo>/" for GitHub Pages project sites (set by the deploy workflow), "/" otherwise.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss(), cspPlugin(), spaFallbackPlugin()],
  server: { port: 5280 },
  preview: { port: 5281 },
  build: {
    rolldownOptions: {
      // Libraries and the crawled catalog change on their own schedules, so each gets a cacheable chunk.
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules/ },
            { name: 'catalog', test: /catalog\.json$/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
