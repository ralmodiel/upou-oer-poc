import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { fixtureVideos } from '../components/test-fixtures'
import { setCatalog } from '../data/testing'
import { resetStorageCache } from '../lib/storage'
import MyListPage from './MyListPage'

// With posters, so the newest videos qualify as starting picks.
beforeEach(() => setCatalog(fixtureVideos.map((v) => ({ ...v, poster: v.backdrop }))))

function renderPage() {
  const router = createMemoryRouter([{ path: '/', element: <MyListPage /> }])
  render(<RouterProvider router={router} />)
}

const save = (ids: string[]) => {
  localStorage.setItem('upou:my-list', JSON.stringify(ids))
  resetStorageCache()
}

describe('MyListPage', () => {
  it('explains how to save and links to Collections when empty', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Nothing saved yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse collections' })).toHaveAttribute(
      'href',
      '/collections',
    )
  })

  it('shows saved videos in saved order', () => {
    save(['ocean-science', 'digital-art', 'gone'])
    renderPage()
    expect(screen.getByText(/2 saved videos/)).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: /^Play / })
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/watch/ocean-science',
      '/watch/digital-art',
    ])
    expect(screen.queryByRole('region', { name: 'Start with the newest' })).toBeNull()
  })

  it('offers the newest videos when empty; a Save there fills the list and keeps focus', () => {
    renderPage()
    const picks = screen.getByRole('region', { name: 'Start with the newest' })
    const buttons = within(picks).getAllByRole('button', { name: /^Save / })
    expect(buttons).toHaveLength(5)
    buttons[1].focus()
    fireEvent.click(buttons[1])
    expect(screen.getByText(/1 saved video,/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Start with the newest' })).toBe(picks)
    expect(document.activeElement).toBe(buttons[1])
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true')
  })

  it('moves focus to the next card, then the one before, then the empty state on unsave', () => {
    save(['ocean-science', 'digital-art', 'climate-basics'])
    renderPage()
    const saveOf = (title: RegExp) => screen.getByRole('button', { name: title })
    fireEvent.click(saveOf(/Save .*Ocean/))
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: /^Save / })[0])
    expect(document.activeElement).toHaveAccessibleName(/Digital Art/i)
    fireEvent.click(saveOf(/Save Climate/))
    expect(document.activeElement).toHaveAccessibleName(/Digital Art/i)
    fireEvent.click(document.activeElement!)
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Browse collections' }))
  })
})
