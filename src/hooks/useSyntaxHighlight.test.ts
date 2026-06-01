import { describe, expect, it } from 'vitest'
import { getShikiTheme } from './useSyntaxHighlight'

describe('getShikiTheme', () => {
  it('uses complete GitHub bundled themes by default', () => {
    expect(getShikiTheme(true).theme).toBe('github-dark-default')
    expect(getShikiTheme(false).theme).toBe('github-light-default')
  })

  it('uses stable cache keys that only depend on syntax theme', () => {
    expect(getShikiTheme(true).key).toBe('github-dark-default')
    expect(getShikiTheme(false).key).toBe('github-light-default')
  })
})
