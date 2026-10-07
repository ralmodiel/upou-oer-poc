// The catalog in pieces, split by the build (catalogSplitPlugin in vite.config.ts, splitCatalog in
// src/data/split.ts): the home summary, then the URLs of the files holding the other videos.
declare module 'virtual:catalog-home' {
  const summary: import('./split').HomeSummary
  export default summary
}

declare module 'virtual:catalog-files' {
  const urls: string[]
  export default urls
}
