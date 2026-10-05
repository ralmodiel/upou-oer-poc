import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import Breadcrumbs from './Breadcrumbs'

describe('Breadcrumbs', () => {
  it('keeps each separator with the crumb before it, so a wrapped trail never starts a line with one', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: 'Browse', to: '/' },
            { label: 'Collections', to: '/collections' },
            { label: 'ODeL' },
          ]}
        />
      </MemoryRouter>,
    )
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.lastElementChild?.tagName.toLowerCase())).toEqual([
      'svg',
      'svg',
      'span',
    ])
    expect(items.map((li) => li.firstElementChild?.tagName.toLowerCase())).not.toContain('svg')
    expect(screen.getByText('ODeL')).toHaveAttribute('aria-current', 'page')
  })
})
