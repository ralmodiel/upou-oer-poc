import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { installFocusMarks } from './focusMarks'

let stop: () => void
beforeEach(() => (stop = installFocusMarks()))
afterEach(() => stop())

it('marks the card around a keyboard-focused card link, and only while it has focus', async () => {
  render(
    <>
      <article className="card-lift group/card" data-testid="card">
        <a href="#a" data-card-link="">
          Card
        </a>
        <button type="button">Save</button>
      </article>
      <button type="button">Elsewhere</button>
    </>,
  )
  const card = screen.getByTestId('card')
  await userEvent.tab()
  expect(card).toHaveAttribute('data-focus-mark')
  // The card's own Save is no card link: the card is not marked as focused.
  await userEvent.tab()
  expect(card).not.toHaveAttribute('data-focus-mark')
  await userEvent.tab({ shift: true })
  expect(card).toHaveAttribute('data-focus-mark')
  screen.getByRole('link').blur()
  expect(card).not.toHaveAttribute('data-focus-mark')
})
