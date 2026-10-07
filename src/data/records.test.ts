import { expect, it } from 'vitest'
import { tidyTitle } from './records'

it('drops a stray trailing separator from a title, and nothing else', () => {
  expect(tidyTitle('What is a Species really? |')).toBe('What is a Species really?')
  expect(tidyTitle('Panel Data Methods – ')).toBe('Panel Data Methods')
  expect(tidyTitle('Part 1 — Private')).toBe('Part 1 — Private')
  expect(tidyTitle('C++')).toBe('C++')
})
