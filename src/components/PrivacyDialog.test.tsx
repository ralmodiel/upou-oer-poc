import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { openPrivacy, pickSources } from '../lib/privacy'
import { readPrefs, setPrefs } from '../lib/storage'
import PrivacyDialog from './PrivacyDialog'

const toggle = (name: string) => screen.getByRole('switch', { name })

describe('PrivacyDialog', () => {
  it('opens from anywhere and switches a home row off', () => {
    render(<PrivacyDialog />)
    act(() => openPrivacy())
    const row = toggle('Recently viewed')
    expect(row).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(row)
    expect(readPrefs().recentlyViewed).toBe(false)
    expect(row).toHaveAttribute('aria-checked', 'false')
  })

  it('shows history-based switches off and unavailable without watch history', () => {
    render(<PrivacyDialog />)
    act(() => openPrivacy())
    fireEvent.click(toggle('Save watch history'))
    for (const name of ['Use watch history for suggestions', 'Because you watched']) {
      expect(toggle(name)).toHaveAttribute('aria-checked', 'false')
      expect(toggle(name)).toHaveAttribute('aria-disabled', 'true')
    }
    // A press does nothing; the remembered choice returns with history.
    fireEvent.click(toggle('Recently viewed'))
    expect(readPrefs().recentlyViewed).toBe(true)
    fireEvent.click(toggle('Save watch history'))
    expect(toggle('Recently viewed')).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps no saved places until "Remember where I stopped" is on, and deletes them when off', () => {
    render(<PrivacyDialog />)
    act(() => openPrivacy())
    const resume = toggle('Remember where I stopped')
    expect(resume).toHaveAttribute('aria-checked', 'false')
    // It also decides whether YouTube's player may keep its own data (YouTubePlayer).
    expect(resume).toHaveAccessibleDescription(/lets the YouTube player keep its own data/)
    fireEvent.click(resume)
    expect(readPrefs().resume).toBe(true)
    localStorage.setItem('upou:positions', JSON.stringify([{ id: 'a', t: 60, at: 1 }]))
    fireEvent.click(resume)
    expect(readPrefs().resume).toBe(false)
    expect(JSON.parse(localStorage.getItem('upou:positions')!)).toEqual([])
    // It rides on the saved watch history.
    fireEvent.click(toggle('Save watch history'))
    expect(resume).toHaveAttribute('aria-disabled', 'true')
  })

  it('deletes watch history when saving it is switched off', () => {
    localStorage.setItem('upou:history', JSON.stringify([{ id: 'a', at: 1 }]))
    render(<PrivacyDialog />)
    act(() => openPrivacy())
    const clear = screen.getByRole('button', { name: 'Clear history' })
    expect(clear).toHaveAccessibleDescription('1 video in your history.')
    expect(clear).not.toHaveAttribute('aria-disabled')
    fireEvent.click(toggle('Save watch history'))
    expect(JSON.parse(localStorage.getItem('upou:history')!)).toEqual([])
    expect(clear).toHaveAttribute('aria-disabled', 'true')
    expect(clear).toHaveAccessibleDescription('No watch history saved.')
  })

  it('clears searches and keeps focus on the button', () => {
    localStorage.setItem('upou:searches', JSON.stringify([{ q: 'climate', at: 1 }]))
    render(<PrivacyDialog />)
    act(() => openPrivacy())
    const clear = screen.getByRole('button', { name: 'Clear searches' })
    expect(clear).toHaveAccessibleDescription('1 search saved.')
    clear.focus()
    fireEvent.click(clear)
    expect(JSON.parse(localStorage.getItem('upou:searches')!)).toEqual([])
    expect(clear).toHaveAccessibleDescription('No searches saved.')
    expect(clear).toHaveAttribute('aria-disabled', 'true')
    expect(clear).toHaveFocus()
  })

  it('returns focus to the control that opened it', () => {
    render(
      <>
        <button type="button" onClick={openPrivacy}>
          Privacy and history
        </button>
        <PrivacyDialog />
      </>,
    )
    const opener = screen.getByRole('button', { name: 'Privacy and history' })
    opener.focus()
    fireEvent.click(opener)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(opener).toHaveFocus()
  })

  it('names only the sources personal picks may use', () => {
    expect(pickSources(readPrefs())).toBe('watched, searched and saved')
    setPrefs({ useHistory: false })
    expect(pickSources(readPrefs())).toBe('searched and saved')
    setPrefs({ searches: false })
    expect(pickSources(readPrefs())).toBe('saved')
  })
})
