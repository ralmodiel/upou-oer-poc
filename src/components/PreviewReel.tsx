import { lazy, type ComponentProps } from 'react'
import type PromoReel from '../features/reel/PromoReel'

type Props = ComponentProps<typeof PromoReel>
const none = (): null => null

/**
 * The promo reel, loaded on the first preview; the chunk is shared with the watch page. A preview
 * is decoration: if the chunk fails (offline, a redeploy) the card keeps its still.
 */
export default lazy(() =>
  import('../features/reel/PromoReel').then(
    (m): { default: (props: Props) => ReturnType<typeof PromoReel> | null } => m,
    () => ({ default: none }),
  ),
)
