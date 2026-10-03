import { lazy } from 'react'

/** The promo reel, loaded on the first preview; the chunk is shared with the watch page. */
export default lazy(() => import('../features/reel/PromoReel'))
