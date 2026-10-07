/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { isValidRecord } from './src/data/records.ts'
import { splitCatalog } from './src/data/split.ts'
import { learnedNamesOf } from './src/lib/tags.ts'

// Strict CSP for production builds only (the dev server needs inline scripts for HMR).
// React style props go through CSSOM, so inline styles need no 'unsafe-inline'.
// "Like on YouTube" (VITE_YT_CLIENT_ID set) adds Google Identity Services and the YouTube Data API.
const GSI = 'https://accounts.google.com/gsi/'
const csp = (yt: boolean) =>
  [
    "default-src 'self'",
    `script-src 'self'${yt ? ` ${GSI}client` : ''}`,
    `style-src 'self'${yt ? ` ${GSI}style` : ''}`,
    "img-src 'self' data: https://i.ytimg.com https://oer.upou.edu.ph",
    `frame-src https://www.youtube-nocookie.com${yt ? ` ${GSI}` : ''}`,
    `connect-src 'self'${yt ? ` ${GSI} https://www.googleapis.com https://oauth2.googleapis.com` : ''}`,
    "font-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

const cspPlugin = (): Plugin => {
  let yt = false
  return {
    name: 'csp-meta',
    apply: 'build',
    configResolved: (c) => {
      yt = !!c.env.VITE_YT_CLIENT_ID
    },
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: csp(yt) },
        injectTo: 'head-prepend',
      },
    ],
  }
}

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

// catalog.json, frame-flags.json and speakers.json joined into smaller tables (src/data/pack.ts) and
// split (src/data/split.ts): the home summary ships with the app, as a JSON.parse of a string
// (browsers parse that faster than the same object literal); every other video goes into JSON files
// the app fetches after its first paint (catalog.ts), each parsing in a few milliseconds on a slow
// phone. As files they never become a script's string literal, which would stay in memory beside
// the parsed records. The dev server and tests get every video in the summary.
const HOME_ID = 'virtual:catalog-home'
const FILES_ID = 'virtual:catalog-files'
const CHUNKS = 6

const catalogSplitPlugin = (): Plugin => {
  let split: ReturnType<typeof splitCatalog> | undefined
  let base = '/'
  let chunks = 0
  const read = (ctx: { addWatchFile(file: string): void }, file: string) => {
    const path = fileURLToPath(new URL(`./src/data/${file}`, import.meta.url))
    ctx.addWatchFile(path)
    return JSON.parse(readFileSync(path, 'utf8'))
  }
  const splitOf = (ctx: { addWatchFile(file: string): void }) =>
    (split ??= splitCatalog(
      read(ctx, 'catalog.json'),
      read(ctx, 'frame-flags.json'),
      read(ctx, 'speakers.json'),
      chunks,
    ))
  const fileNames: string[] = []
  return {
    name: 'catalog-split',
    configResolved: (config) => {
      base = config.base
      chunks = config.command === 'build' ? CHUNKS : 0
    },
    buildStart() {
      split = undefined
      fileNames.length = 0
      if (!chunks) return
      splitOf(this).files.forEach((file, i) => {
        const source = JSON.stringify(file)
        const hash = createHash('sha1').update(source).digest('hex').slice(0, 8)
        const fileName = `assets/catalog-${i}-${hash}.json`
        this.emitFile({ type: 'asset', fileName, source })
        fileNames.push(fileName)
      })
    },
    resolveId: (id) => (id === HOME_ID || id === FILES_ID ? `\0${id}` : undefined),
    load(id) {
      if (id === `\0${FILES_ID}`)
        return `export default ${JSON.stringify(fileNames.map((f) => base + f))}`
      if (id !== `\0${HOME_ID}`) return
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(splitOf(this).summary))})`
    },
  }
}

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

// Engines before Chromium 99 (LG webOS 6 and 22 browsers are Chromium 79 and 87) ignore every
// `@layer` block, which is all of Tailwind. The same rules, unlayered and in source order, go to
// legacy-layers.css; src/lib/lite.ts loads it first on those engines only.
// padding/margin/inset-inline|block arrived in Chromium 87 and Vite leaves them: LTR-only app, so
// the physical sides say the same thing (single-value forms only; a two-value one is left alone).
const SIDES: Record<string, string[]> = {
  inline: ['left', 'right'],
  'inline-start': ['left'],
  'inline-end': ['right'],
  block: ['top', 'bottom'],
  'block-start': ['top'],
  'block-end': ['bottom'],
}
const LOGICAL = /(?<=[{;])(padding|margin|inset)-(inline|block)(-start|-end)?:/g
const physical = (css: string) => {
  let out = ''
  let last = 0
  for (const m of css.matchAll(LOGICAL)) {
    const from = m.index + m[0].length
    let end = from
    let depth = 0
    let single = true
    for (; end < css.length; end++) {
      const c = css[end]
      if (c === '(') depth++
      else if (c === ')') depth--
      else if (depth === 0 && (c === ';' || c === '}')) break
      else if (depth === 0 && c === ' ') single = false
    }
    if (!single || m.index < last) continue
    const value = css.slice(from, end)
    out += css.slice(last, m.index)
    out += SIDES[m[2] + (m[3] ?? '')]!.map(
      (side) => `${m[1] === 'inset' ? '' : m[1] + '-'}${side}:${value}`,
    ).join(';')
    last = end
  }
  return out + css.slice(last)
}

const legacyLayersPlugin = (): Plugin => ({
  name: 'legacy-layers',
  apply: 'build',
  generateBundle(_, bundle) {
    let css = ''
    for (const file of Object.values(bundle)) {
      if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue
      const src = (file.source = physical(String(file.source)))
      for (let at = src.indexOf('@layer'); at >= 0;) {
        const open = src.indexOf('{', at)
        const semi = src.indexOf(';', at)
        if (open < 0 || (semi >= 0 && semi < open)) {
          at = src.indexOf('@layer', semi + 1)
          continue
        }
        let depth = 1
        let end = open + 1
        for (; end < src.length && depth > 0; end++)
          depth += src[end] === '{' ? 1 : src[end] === '}' ? -1 : 0
        css += src.slice(open + 1, end - 1)
        at = src.indexOf('@layer', end)
      }
    }
    if (css) this.emitFile({ type: 'asset', fileName: 'legacy-layers.css', source: css })
  },
})

export default defineConfig({
  // "/<repo>/" for GitHub Pages project sites (set by the deploy workflow), "/" otherwise.
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    catalogNamesPlugin(),
    catalogSplitPlugin(),
    cspPlugin(),
    legacyLayersPlugin(),
    spaFallbackPlugin(),
  ],
  server: { port: 5280 },
  preview: { port: 5281 },
  build: {
    // Chromium 79 (LG webOS 6, the oldest engine the app supports): lowers `?.`, `??`, range media
    // queries and the like. Vite's default (Chromium 111) leaves them, and old engines fail to parse.
    target: 'chrome79',
    // Every browser Tailwind 4 supports has native modulepreload; skip the polyfill.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      // Libraries and the crawled catalog change on their own schedules, so each gets a cacheable chunk.
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules/ },
            { name: 'catalog', test: /catalog-(names|home|files)$/ },
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
    // A file's first test imports the whole catalog; on a busy machine that alone can near 5 s.
    testTimeout: 15_000,
  },
})
