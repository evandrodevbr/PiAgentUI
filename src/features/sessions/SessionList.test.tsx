import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiSession } from '../../api'
import { SessionList, SessionListItem } from './SessionList'

const { useSessionActiveEntryMock, useHasUnreadCompletedNotificationMock, markSessionNotificationsReadMock } =
  vi.hoisted(() => ({
    useSessionActiveEntryMock: vi.fn(),
    useHasUnreadCompletedNotificationMock: vi.fn(),
    markSessionNotificationsReadMock: vi.fn(),
  }))

vi.mock('../../store/activeSessionStore', () => ({
  useSessionActiveEntry: (...args: unknown[]) => useSessionActiveEntryMock(...args),
}))

vi.mock('../../store/notificationStore', () => ({
  notificationStore: {
    markSessionNotificationsRead: markSessionNotificationsReadMock,
  },
  useHasUnreadCompletedNotification: (...args: unknown[]) => useHasUnreadCompletedNotificationMock(...args),
}))

vi.mock('../../hooks/useInputCapabilities', () => ({
  useInputCapabilities: () => ({ preferTouchUi: false }),
}))

vi.mock('../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}))

vi.mock('../chat/sidebar/SessionChildrenSlot', () => ({
  SessionChildrenSlot: () => null,
}))

describe('SessionListItem', () => {
  const session: ApiSession = {
    id: 'session-1',
    title: 'Session One',
    directory: '/workspace/demo',
    time: { updated: 1 },
  } as ApiSession

  beforeEach(() => {
    useSessionActiveEntryMock.mockReturnValue(null)
    useHasUnreadCompletedNotificationMock.mockReturnValue(false)
    markSessionNotificationsReadMock.mockReset()
  })

  it('renders the session row as a semantic button and selects it', () => {
    const onSelect = vi.fn()

    render(
      <SessionListItem
        session={session}
        isSelected={false}
        onSelect={onSelect}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        preferTouchUi={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Session One/i }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(markSessionNotificationsReadMock).toHaveBeenCalledWith('session-1', 'completed')
  })

  it('keeps the full session row clickable outside the inner content button', () => {
    const onSelect = vi.fn()

    render(
      <SessionListItem
        session={session}
        isSelected={false}
        onSelect={onSelect}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        preferTouchUi={false}
      />,
    )

    const sessionButton = screen.getByRole('button', { name: /Session One/i })
    const sessionRow = sessionButton.parentElement

    expect(sessionRow).not.toBeNull()

    fireEvent.click(sessionRow!)

    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

describe('SessionList project folders', () => {
  const sessions = [
    {
      id: 'session-a',
      title: 'Project A chat',
      directory: 'D:/work/project-a',
      time: { created: 100, updated: 100 },
      status: { type: 'idle' },
    },
    {
      id: 'session-b',
      title: 'Project B chat',
      directory: 'D:/work/project-b',
      time: { created: 200, updated: 200 },
      status: { type: 'idle' },
    },
  ] as ApiSession[]

  beforeEach(() => {
    useSessionActiveEntryMock.mockReturnValue(null)
    useHasUnreadCompletedNotificationMock.mockReturnValue(false)
    markSessionNotificationsReadMock.mockReset()
  })

  it('renders sessions inside collapsible project folders', () => {
    render(
      <SessionList
        sessions={sessions}
        selectedId={null}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        search=""
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onLoadMore={vi.fn()}
        onNewChat={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /project-a/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /project-b/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Project A chat/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /project-a/i }))

    expect(screen.queryByRole('button', { name: /Project A chat/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Project B chat/i })).toBeInTheDocument()
  })
})
