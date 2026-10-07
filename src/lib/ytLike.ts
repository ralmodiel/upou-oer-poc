// "Like on YouTube": the opt-in button on the watch page. Present only when the build has
// VITE_YT_CLIENT_ID (a public OAuth client ID) and the profile is not lite; absent otherwise.
// Nothing contacts Google until the viewer presses Like: Google Identity Services (token model)
// loads on that first press. The access token lives in this module's memory only, never in storage.
// Docs: docs/youtube-like-setup.md.
import { useSyncExternalStore } from 'react'
import { lite } from './lite'

export const CLIENT_ID = import.meta.env.VITE_YT_CLIENT_ID as string | undefined
export const ytLikeEnabled = !!CLIENT_ID && !lite

// Narrowest scope listed for videos.rate (the others are youtube and youtubepartner).
const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl'
const GSI = 'https://accounts.google.com/gsi/client'
const API = 'https://www.googleapis.com/youtube/v3/videos'

export type Rating = 'like' | 'none'

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
}
interface GoogleOAuth {
  initTokenClient(cfg: {
    client_id: string
    scope: string
    callback: (r: TokenResponse) => void
    error_callback?: (e: unknown) => void
  }): { requestAccessToken(): void }
  revoke(token: string, done?: () => void): void
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } }
  }
}

let token: { value: string; expires: number } | null = null
let script: Promise<GoogleOAuth> | null = null
const listeners = new Set<() => void>()
const setToken = (t: typeof token) => {
  token = t
  listeners.forEach((l) => l())
}

/** True while an access token is held in memory (for the Privacy panel's Disconnect). */
export const useYtConnected = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => token !== null,
  )

function loadGsi(): Promise<GoogleOAuth> {
  script ??= new Promise((resolve, reject) => {
    const done = () => {
      const g = window.google?.accounts?.oauth2
      if (g) resolve(g)
      else fail()
    }
    const fail = () => {
      script = null // a later press may retry
      reject(new Error('gsi'))
    }
    const el = document.createElement('script')
    el.src = GSI
    el.async = true
    el.onload = done
    el.onerror = fail
    document.head.appendChild(el)
  })
  return script
}

/** A valid token, asking Google (popup, so call from a press) when none is held. */
async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 30_000) return token.value
  const oauth = await loadGsi()
  return new Promise((resolve, reject) => {
    oauth
      .initTokenClient({
        client_id: CLIENT_ID ?? '',
        scope: SCOPE,
        callback: (r) => {
          if (!r.access_token || r.error) return reject(new Error('auth'))
          setToken({
            value: r.access_token,
            expires: Date.now() + Number(r.expires_in ?? 3600) * 1000,
          })
          resolve(r.access_token)
        },
        error_callback: () => reject(new Error('auth')),
      })
      .requestAccessToken()
  })
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}` },
  })
  if (res.status === 401) setToken(null)
  if (!res.ok) throw new Error(`api ${res.status}`)
  return res
}

export async function getRating(id: string): Promise<Rating> {
  const body = (await (await call(`getRating?id=${encodeURIComponent(id)}`)).json()) as {
    items?: { rating?: string }[]
  }
  return body.items?.[0]?.rating === 'like' ? 'like' : 'none'
}

export async function rate(id: string, rating: Rating): Promise<void> {
  await call(`rate?id=${encodeURIComponent(id)}&rating=${rating}`, { method: 'POST' })
}

/** Forget the token here and revoke it at Google. Contacts Google only if a token was held. */
export async function disconnectYt(): Promise<void> {
  const t = token
  setToken(null)
  if (!t) return
  try {
    const oauth = await loadGsi()
    await new Promise<void>((done) => oauth.revoke(t.value, done))
  } catch {
    // The token also expires within the hour.
  }
}

export const hasYtToken = () => token !== null
