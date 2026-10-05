/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { isValidRecord } from './src/data/records.ts'
import { learnedNamesOf } from './src/lib/tags.ts'

// Strict CSP for production builds only (the dev server needs inline scripts for HMR).
// React style props go through CSSOM, so inline styles need no 'unsafe-inline'.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https://i.ytimg.com https://oer.upou.edu.ph",
  'frame-src https://www.youtube-nocookie.com',
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

// The names tags.ts learns from the catalog (speakers in its tags and titles), learned once here
// so the browser skips that work; the app imports them as virtual:catalog-names.
const CATALOG = fileURLToPath(new URL('./src/data/catalog.json', import.meta.url))
const NAMES_ID = 'virtual:catalog-names'

const catalogNamesPlugin = (): Plugin => ({
  name: 'catalog-names',
  resolveId: (id) => (id === NAMES_ID ? `\0${NAMES_ID}` : undefined),
  load(id) {
    if (id !== `\0${NAMES_ID}`) return
    this.addWatchFile(CATALOG)
    const records: unknown[] = JSON.parse(readFileSync(CATALOG, 'utf8'))
    const videos = records.filter(isValidRecord).map((r) => ({ tags: r.g ?? [], title: r.t }))
    return `export default ${JSON.stringify(learnedNamesOf(videos))}`
  },
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
  plugins: [react(), tailwindcss(), catalogNamesPlugin(), cspPlugin(), spaFallbackPlugin()],
  server: { port: 5280 },
  preview: { port: 5281 },
  build: {
    // Every browser Tailwind 4 supports has native modulepreload; skip the polyfill.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      // Libraries and the crawled catalog change on their own schedules, so each gets a cacheable chunk.
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules/ },
            { name: 'catalog', test: /(catalog|frame-flags|speakers)\.json$|catalog-names$/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    // Local working data (tmp/) may hold copies of the tree; never test them.
    exclude: ['**/node_modules/**', '**/dist/**', 'tmp/**'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
