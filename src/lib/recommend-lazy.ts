// The recommender (TF-IDF index plus the text pipeline) as an on-demand chunk. Pages that need
// it after the first paint load it here; `src/lib/recommend` stays importable for synchronous
// callers, which keeps it in their chunk instead.
export type Recommender = typeof import('./recommend')

let pending: Promise<Recommender> | undefined

/** Loads the recommender once (later calls share the promise) and resolves to its exports. */
export const loadRecommender = (): Promise<Recommender> => (pending ??= import('./recommend'))

/** Starts the download without waiting (e.g. from an idle callback) and builds the index. */
export const prefetchRecommender = (): void => {
  void loadRecommender().then((m) => m.warmRecommender())
}
