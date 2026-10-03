import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { openPrivacy } from '../lib/privacy'
import { readPrefs } from '../lib/storage'
import PrivacyDialog from './PrivacyDialog'

describe('PrivacyDialog', () => {
  it('opens from anywhere and switches a home row off', () => {
    render(<PrivacyDialog />)
    act(() => openPrivacy())
    const row = screen.getByRole('switch', { name: 'Recently viewed' })
    expect(row).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(row)
    expect(readPrefs().recentlyViewed).toBe(false)
    expect(row).toHaveAttribute('aria-checked', 'false')
  })

  it('disables history-based switches when watch history is not saved', () => {
    render(<PrivacyDialog />)
    act(() => openPrivacy())
    fireEvent.click(screen.getByRole('switch', { name: 'Save watch history' }))
    expect(screen.getByRole('switch', { name: 'Because you watched' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Recently viewed' })).toBeDisabled()
  })
})
