import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CodeBlock } from './CodeBlock'

const useIsMobileMock = vi.fn(() => false)
const themeSnapshot = { codeWordWrap: false }

vi.mock('../hooks/useIsMobile', () => ({
  useIsMobile: () => useIsMobileMock(),
}))

vi.mock('../hooks/useSyntaxHighlight', () => ({
  useSyntaxHighlight: () => ({ output: '' }),
}))

vi.mock('../hooks/useInView', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

vi.mock('../store/themeStore', () => ({
  themeStore: {
    subscribe: () => () => {},
    getSnapshot: () => themeSnapshot,
  },
}))

vi.mock('./ui', () => ({
  CopyButton: ({ className }: { className?: string }) => (
    <button aria-label="Copy to clipboard" className={className}>
      copy
    </button>
  ),
}))

describe('CodeBlock', () => {
  beforeEach(() => {
    useIsMobileMock.mockReset()
    useIsMobileMock.mockReturnValue(false)
  })

  it('requires tap-to-reveal copy button for unlabeled mobile code blocks', () => {
    useIsMobileMock.mockReturnValue(true)

    const { container } = render(<CodeBlock code="const value = 1" />)

    expect(container.firstChild).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'Copy to clipboard' }).parentElement?.className).toContain(
      '[@media(hover:none)]:opacity-0',
    )
  })

  it('keeps labeled mobile code blocks unchanged', () => {
    useIsMobileMock.mockReturnValue(true)

    const { container } = render(<CodeBlock code="const value = 1" language="ts" />)

    expect(container.firstChild).not.toHaveAttribute('tabindex')
    expect(screen.getByText('ts')).toBeInTheDocument()
  })
})
