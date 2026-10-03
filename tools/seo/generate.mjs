// Runs after `vite build`: node tools/seo/generate.mjs [--dist dist] [--limit N]
// Reads BASE_PATH and VITE_SITE_URL from the environment, like the build does.
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { generate } from './lib.mjs'

const { values } = parseArgs({
  options: {
    dist: { type: 'string', default: 'dist' },
    // First N catalog records only (tests).
    limit: { type: 'string' },
  },
})

try {
  await access(join(values.dist, 'index.html'))
} catch {
  console.error(`seo: ${join(values.dist, 'index.html')} not found; run vite build first`)
  process.exit(1)
}

const result = await generate({
  dist: values.dist,
  limit: values.limit ? Number(values.limit) : undefined,
})
const size = `${(result.bytes / 1e6).toFixed(1)} MB`
const sitemap = result.sitemap ? 'sitemap.xml' : 'no sitemap (VITE_SITE_URL is unset)'
console.log(
  `seo: ${result.files} files (${size}), ${result.urls} URLs, ${sitemap}, ${(result.ms / 1000).toFixed(1)} s`,
)
