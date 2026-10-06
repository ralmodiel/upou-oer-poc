import { afterEach, describe, expect, it, vi } from 'vitest'

const load = async (ua: string, search = '', memory?: number) => {
  vi.resetModules()
  document.documentElement.removeAttribute('data-lite')
  vi.stubGlobal('navigator', { userAgent: ua, deviceMemory: memory })
  window.history.replaceState(null, '', `/${search}`)
  const { lite } = await import('./lite')
  return { lite, attr: document.documentElement.hasAttribute('data-lite') }
}

const WEBOS =
  'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.128 Safari/537.36 WebAppManager'
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'

describe('lite profile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('is on for a webOS TV and marks <html>', async () => {
    expect(await load(WEBOS)).toEqual({ lite: true, attr: true })
  })
  it('is on for a Tizen TV, low device memory and a Chromium before 100', async () => {
    expect(
      (await load('Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) Chrome/76.0 TV Safari/537.36')).lite,
    ).toBe(true)
    expect((await load(DESKTOP, '', 2)).lite).toBe(true)
    expect((await load('Mozilla/5.0 Chrome/87.0.4280.0 Safari/537.36')).lite).toBe(true)
  })
  it('is off for a desktop and follows ?lite=1 / ?lite=0', async () => {
    expect(await load(DESKTOP, '', 8)).toEqual({ lite: false, attr: false })
    expect((await load(DESKTOP, '?lite=1')).lite).toBe(true)
    expect((await load(WEBOS, '?lite=0')).lite).toBe(false)
  })
})
