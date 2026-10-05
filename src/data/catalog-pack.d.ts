// catalog.json, frame-flags.json and speakers.json as one table, packed by the build
// (catalogPack in vite.config.ts, packCatalog in src/data/pack.ts).
declare module 'virtual:catalog-pack' {
  const pack: import('./pack').CatalogPack
  export default pack
}
