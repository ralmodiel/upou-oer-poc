// Smoke test for the shell generator: runs the CLI against a stand-in dist and checks the output
// against the app's own catalog, so drift between tools/seo/catalog.mjs and src/data shows here.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getCategories } from '../../src/data/catalog'
import records from '../../src/data/catalog.json'
import { expandRecord } from '../../src/data/expand'
import { setCatalog } from '../../src/data/testing'
import { pageTitle } from '../../src/lib/seo'
import { loadCatalog } from './catalog.mjs'

const SITE = 'https://example.github.io/upou-networks'
const LIMIT = 40
const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="description"
      content="Default"
    />
    <title>UPOU OER</title>
    <script type="module" crossorigin src="/upou-networks/assets/index.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

describe('tools/seo/generate.mjs', () => {
  const dist = mkdtempSync(join(tmpdir(), 'upou-seo-'))
  afterEach(() => rmSync(dist, { recursive: true, force: true }))
  const run = () =>
    execFileSync(
      process.execPath,
      ['tools/seo/generate.mjs', '--dist', dist, '--limit', String(LIMIT)],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, BASE_PATH: '/upou-networks/', VITE_SITE_URL: SITE },
      },
    )

  it('writes shells, a sitemap and robots.txt for a base-path build, repeatably', () => {
    writeFileSync(join(dist, 'index.html'), TEMPLATE)
    expect(run()).toMatch(/^seo: \d+ files/)
    const sample = records.slice(0, LIMIT)
    setCatalog(sample)
    const slugs = getCategories().map((c) => c.slug)
    expect(slugs.length).toBeGreaterThan(1)

    const home = readFileSync(join(dist, 'index.html'), 'utf8')
    expect(home).toContain(
      '<title>UPOU OER · Open Educational Resources from UP Open University</title>',
    )
    expect(home).toContain(`<link rel="canonical" href="${SITE}/" data-seo />`)
    expect(home.match(/name="description"/g)).toHaveLength(1)
    expect(home).toContain(
      '<script type="module" crossorigin src="/upou-networks/assets/index.js">',
    )
    for (const slug of slugs) {
      expect(home).toContain(`href="${SITE}/collections/${slug}/"`)
      expect(existsSync(join(dist, 'collections', slug, 'index.html'))).toBe(true)
    }

    const first = expandRecord(sample[0])
    const shell = readFileSync(join(dist, 'watch', first.id, 'index.html'), 'utf8')
    expect(shell).toContain(`<title>${escapeHtml(pageTitle(first.title))}</title>`)
    expect(shell).toContain(
      `<h1 class="mt-3 font-display text-title text-ink">${escapeHtml(first.title)}</h1>`,
    )
    expect(shell).toContain(`href="https://www.youtube.com/watch?v=${first.youtubeId}"`)
    const ld = JSON.parse(
      shell.match(/<script type="application\/ld\+json" data-seo>(.*?)<\/script>/)[1],
    )
    expect(ld[0]).toMatchObject({ '@type': 'VideoObject', url: `${SITE}/watch/${first.id}/` })
    expect(ld[0].thumbnailUrl).toEqual(expect.arrayContaining(first.thumbnails))

    // Search and My List: shells so a direct load is a 200, but noindex and out of the sitemap.
    for (const [dir, title] of [
      ['search', 'Search · UPOU OER'],
      ['my-list', 'My List · UPOU OER'],
    ]) {
      const page = readFileSync(join(dist, dir, 'index.html'), 'utf8')
      expect(page).toContain(`<title>${title}</title>`)
      expect(page).toContain('<meta name="robots" content="noindex, follow" data-seo />')
      expect(page).not.toMatch(/rel="canonical"|property="og:url"/)
      expect(page).toContain(
        '<script type="module" crossorigin src="/upou-networks/assets/index.js">',
      )
    }

    const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8')
    expect(sitemap.match(/<url>/g)).toHaveLength(2 + slugs.length + LIMIT)
    expect(sitemap).toContain(
      `<loc>${SITE}/watch/${first.id}/</loc><lastmod>${first.publishedAt}</lastmod>`,
    )
    expect(sitemap).not.toMatch(/\/(search|my-list)\//)
    const robots = readFileSync(join(dist, 'robots.txt'), 'utf8')
    expect(robots).toContain('Disallow: /upou-networks/search')
    expect(robots).toContain('Disallow: /upou-networks/my-list')
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`)

    run()
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).toBe(home)
  })

  it('sees the catalog as the app does: videos, canonical images and collection order', () => {
    const node = loadCatalog(records)
    const app = new Map(records.map((r) => [r.id, expandRecord(r)]))
    expect(node.videos).toHaveLength(app.size)
    for (const v of node.videos) {
      // Only the per-load picks (thumbnail, backdrop) may differ.
      expect(v).toEqual({ ...app.get(v.id), thumbnail: v.thumbnail, backdrop: v.backdrop })
    }
    setCatalog(records)
    expect(node.categories.map((c) => c.slug)).toEqual(getCategories().map((c) => c.slug))
    expect(node.categories.at(-1).name).toBe('General')
  })
})
