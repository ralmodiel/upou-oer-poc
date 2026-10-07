import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testVideo } from '../reel/testing'

let rating = 'none'
const fetchMock = vi.fn()
const revoke = vi.fn((_t: string, done?: () => void) => done?.())
const requestAccessToken = vi.fn()
const initTokenClient = vi.fn(
  (cfg: { callback: (r: { access_token: string; expires_in: number }) => void }) => ({
    requestAccessToken: () => {
      requestAccessToken()
      cfg.callback({ access_token: 'tok', expires_in: 3600 })
    },
  }),
)

// The GSI <script> never loads in jsdom: appending it stands in for the load.
function fakeGsi() {
  vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
    const el = node as HTMLScriptElement
    window.google = { accounts: { oauth2: { initTokenClient, revoke } as never } }
    queueMicrotask(() => el.onload?.(new Event('load')))
    return node
  })
}

async function load(id: string | undefined) {
  vi.resetModules()
  vi.stubEnv('VITE_YT_CLIENT_ID', id ?? '')
  const [{ default: LikeButton }, lib] = await Promise.all([
    import('./LikeButton'),
    import('../../lib/ytLike'),
  ])
  return { LikeButton, lib }
}

const press = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /like/i }))
  })
}

beforeEach(() => {
  rating = 'none'
  fetchMock.mockReset().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('getRating'))
      return Promise.resolve(Response.json({ items: [{ videoId: 'x', rating }] }))
    return Promise.resolve(new Response(null, { status: init?.method === 'POST' ? 204 : 200 }))
  })
  vi.stubGlobal('fetch', fetchMock)
  initTokenClient.mockClear()
  requestAccessToken.mockClear()
  revoke.mockClear()
  fakeGsi()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  delete window.google
})

describe('Like on YouTube', () => {
  it('is absent, and contacts nothing, without a client ID', async () => {
    const { LikeButton } = await load(undefined)
    const { container } = render(<LikeButton video={testVideo} />)
    expect(container).toBeEmptyDOMElement()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.head.appendChild).not.toHaveBeenCalled()
  })

  it('shows the button but loads Google only on the first press', async () => {
    const { LikeButton } = await load('cid.apps.googleusercontent.com')
    render(<LikeButton video={testVideo} />)
    expect(screen.getByRole('button', { name: 'Like on YouTube' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(document.head.appendChild).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    await press()
    expect(document.head.appendChild).toHaveBeenCalledTimes(1)
    expect(initTokenClient.mock.calls[0][0]).toMatchObject({
      client_id: 'cid.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
    })
  })

  it('signs in, reads the rating, likes, then removes the like with rating=none', async () => {
    const { LikeButton } = await load('cid')
    render(<LikeButton video={testVideo} />)
    await press()
    const urls = fetchMock.mock.calls.map((c) => c[0] as string)
    expect(urls[0]).toContain(`getRating?id=${testVideo.youtubeId}`)
    expect(urls[1]).toContain(`rate?id=${testVideo.youtubeId}&rating=like`)
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(screen.getByRole('button', { name: /Liked on YouTube/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await press()
    expect(fetchMock.mock.calls[2][0]).toContain('rating=none')
    expect(requestAccessToken).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Like on YouTube' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows a video already liked as liked, and does not unlike it on sign-in', async () => {
    rating = 'like'
    const { LikeButton } = await load('cid')
    render(<LikeButton video={testVideo} />)
    await press()
    expect(fetchMock.mock.calls.some((c) => (c[0] as string).includes('/rate?'))).toBe(false)
    expect(screen.getByRole('button', { name: /Liked on YouTube/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('reads the current rating on arrival once signed in', async () => {
    const { LikeButton, lib } = await load('cid')
    rating = 'like'
    await lib.getRating('abc') // signs in (mock)
    render(<LikeButton video={testVideo} />)
    expect(await screen.findByRole('button', { name: /Liked on YouTube/ })).toBeInTheDocument()
  })

  it('says so when YouTube cannot be reached', async () => {
    const { LikeButton } = await load('cid')
    fetchMock.mockRejectedValue(new TypeError('offline'))
    render(<LikeButton video={testVideo} />)
    await press()
    expect(screen.getByRole('status')).toHaveTextContent('Couldn’t reach YouTube')
    expect(screen.getByRole('button', { name: 'Like on YouTube' })).toBeEnabled()
  })

  it('Disconnect revokes the token and forgets it', async () => {
    const { lib } = await load('cid')
    await lib.getRating('abc')
    expect(lib.hasYtToken()).toBe(true)
    await lib.disconnectYt()
    expect(revoke).toHaveBeenCalledWith('tok', expect.any(Function))
    expect(lib.hasYtToken()).toBe(false)
    await lib.disconnectYt() // nothing held: no second revoke
    expect(revoke).toHaveBeenCalledTimes(1)
  })

  it('keeps the token out of storage', async () => {
    const { lib } = await load('cid')
    await lib.getRating('abc')
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('tok')
  })
})
