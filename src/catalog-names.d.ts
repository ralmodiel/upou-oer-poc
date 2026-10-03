// The names src/lib/tags.ts learns from src/data/catalog.json, learned once by the build
// (catalogNames in vite.config.ts) rather than in the browser. Same shape as LearnedNames.
declare module 'virtual:catalog-names' {
  const names: { firstNames: string[]; nameTokens: string[]; surnameTags: string[] }
  export default names
}
