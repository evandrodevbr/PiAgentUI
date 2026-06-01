import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MessageRenderer } from './MessageRenderer'
import type { Message } from '../../types/message'

vi.mock('motion/mini', () => ({
  animate: () => Promise.resolve(),
}))

vi.mock('../../hooks', () => ({
  useDelayedRender: (show: boolean) => show,
}))

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    collapseUserMessages: false,
    stepFinishDisplay: { turnDuration: false },
    descriptiveToolSteps: false,
    inlineToolRequests: false,
    immersiveMode: false,
  }),
}))

vi.mock('../../components/ui', () => ({
  CopyButton: ({ text }: { text: string }) => <button type="button">copy:{text}</button>,
  SmoothHeight: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('./parts', () => ({
  TextPartView: ({ part }: { part: { text: string } }) => <div>{part.text}</div>,
  ReasoningPartView: () => null,
  ToolPartView: () => null,
  FilePartView: () => null,
  AgentPartView: () => null,
  SyntheticTextPartView: () => null,
  StepFinishPartView: () => null,
  SubtaskPartView: () => null,
  RetryPartView: () => null,
  CompactionPartView: () => <div>History compacted</div>,
  MessageErrorView: () => null,
}))

function createAssistantMessage(): Message {
  return {
    info: {
      id: 'assistant-1',
      sessionID: 'session-1',
      role: 'assistant',
      parentID: 'user-1',
      modelID: 'model-1',
      providerID: 'provider-1',
      mode: 'chat',
      agent: 'build',
      path: { cwd: '/workspace', root: '/workspace' },
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      time: { created: 1 },
    },
    parts: [
      {
        id: 'text-1',
        sessionID: 'session-1',
        messageID: 'assistant-1',
        type: 'text',
        text: 'assistant reply',
      },
    ],
    isStreaming: false,
  }
}

function createUserMessage(): Message {
  return {
    info: {
      id: 'user-1',
      sessionID: 'session-1',
      role: 'user',
      time: { created: 1 },
      agent: 'build',
      model: { modelID: 'model-1', providerID: 'provider-1' },
    },
    parts: [],
    isStreaming: false,
  }
}

describe('MessageRenderer assistant fork', () => {
  it('does not render non-chat roles as assistant text', () => {
    const message = {
      info: {
        id: 'tool-result-1',
        sessionID: 'session-1',
        role: 'toolResult',
        time: { created: 1, completed: 1 },
      },
      parts: [
        {
          id: 'tool-result-1-text',
          sessionID: 'session-1',
          messageID: 'tool-result-1',
          type: 'text',
          text: 'raw tool output must not render as chat text',
        },
      ],
      isStreaming: false,
    } as unknown as Message

    render(<MessageRenderer message={message} />)

    expect(screen.queryByText('raw tool output must not render as chat text')).toBeNull()
  })

  it('passes the explicit fork target id when forking an assistant message', async () => {
    const onFork = vi.fn()
    const message = createAssistantMessage()

    render(<MessageRenderer message={message} onFork={onFork} forkMessageId="assistant-2" />)

    fireEvent.click(screen.getByRole('button', { name: /fork|分叉/i }))

    await waitFor(() => {
      expect(onFork).toHaveBeenCalledWith(message, 'assistant-2')
    })
  })

  it('hides fork when the assistant message has no copyable text', () => {
    const onFork = vi.fn()
    const message = createAssistantMessage()
    message.parts = [
      {
        id: 'text-blank',
        sessionID: 'session-1',
        messageID: 'assistant-1',
        type: 'text',
        text: '   ',
      },
    ]

    render(<MessageRenderer message={message} onFork={onFork} forkMessageId="assistant-2" />)

    expect(screen.queryByRole('button', { name: /fork|分叉/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('renders compaction parts inside user messages', () => {
    const message = createUserMessage()
    message.parts = [
      {
        id: 'compaction-1',
        sessionID: 'session-1',
        messageID: 'user-1',
        type: 'compaction',
        auto: true,
      },
    ]

    render(<MessageRenderer message={message} />)

    expect(screen.getByText('History compacted')).toBeInTheDocument()
  })
})
