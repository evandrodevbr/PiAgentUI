import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiMessage, ApiMessageWithParts, ApiPart } from '../api/types'
import { messageStore } from './messageStore'

function createAssistantMessage(id: string, sessionID = 'session-1'): ApiMessage {
  return {
    id,
    sessionID,
    role: 'assistant',
    parentID: 'user-1',
    modelID: 'model-1',
    providerID: 'provider-1',
    mode: 'chat',
    agent: 'build',
    path: {
      cwd: '/workspace',
      root: '/workspace',
    },
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    time: {
      created: 1,
      completed: 2,
    },
  }
}

function createUserMessage(id: string, text: string, created = 1, sessionID = 'session-1'): ApiMessage {
  return {
    id,
    sessionID,
    role: 'user',
    time: { created, completed: created },
    text,
    model: {
      providerID: 'provider-1',
      modelID: 'model-1',
    },
  }
}

function createTextPart(
  id: string,
  messageID: string,
  text: string,
  sessionID = 'session-1',
): ApiPart & { sessionID: string; messageID: string } {
  return {
    id,
    sessionID,
    messageID,
    type: 'text',
    text,
  }
}

function createMessageWithParts(id: string, text: string, sessionID = 'session-1'): ApiMessageWithParts {
  return {
    info: createAssistantMessage(id, sessionID),
    parts: [createTextPart(`part-${id}`, id, text, sessionID)],
  }
}

describe('messageStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    messageStore.clearAll()
  })

  it('applies a part update when the message already exists', () => {
    messageStore.handleMessageUpdated(createAssistantMessage('message-1'))
    messageStore.handlePartUpdated(createTextPart('part-1', 'message-1', 'hello'))

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages).toHaveLength(1)
    expect(state?.messages[0].parts).toHaveLength(1)
    expect(state?.messages[0].parts[0]).toMatchObject({ id: 'part-1', type: 'text', text: 'hello' })
  })

  it('creates a placeholder message when a part update arrives before message.updated', () => {
    messageStore.handlePartUpdated(createTextPart('part-1', 'message-1', 'hello'))

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages).toHaveLength(1)
    expect(state?.messages[0].info).toMatchObject({ id: 'message-1', role: 'assistant', sessionID: 'session-1' })
    expect(state?.messages[0].parts[0]).toMatchObject({ id: 'part-1', type: 'text', text: 'hello' })
    expect(state?.isStreaming).toBe(true)
  })

  it('creates a placeholder message and text part when a delta arrives first', () => {
    messageStore.handlePartDelta({
      sessionID: 'session-1',
      messageID: 'message-1',
      partID: 'message-1-text',
      field: 'text',
      delta: 'hello',
    })

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages).toHaveLength(1)
    expect(state?.messages[0].parts[0]).toMatchObject({ id: 'message-1-text', type: 'text', text: 'hello' })
  })

  it('reconciles the final message.updated text into the streamed text part', () => {
    messageStore.handleMessageUpdated(createAssistantMessage('message-1'))
    messageStore.handlePartUpdated(createTextPart('message-1-text', 'message-1', 'partial'))

    messageStore.handleMessageUpdated({
      ...createAssistantMessage('message-1'),
      text: 'partial plus final text',
      time: { created: 1, completed: 2 },
    })

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages[0].parts[0]).toMatchObject({ id: 'message-1-text', text: 'partial plus final text' })
  })

  it('creates a visible text part for user message.updated text', () => {
    messageStore.handleMessageUpdated(createUserMessage('user-1', 'hello from user'))

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages[0].info).toMatchObject({ id: 'user-1', role: 'user' })
    expect(state?.messages[0].parts[0]).toMatchObject({ id: 'user-1-text', type: 'text', text: 'hello from user' })
  })

  it('reuses an existing text part when fetched user message parts use a -text-0 suffix', () => {
    messageStore.handleMessageUpdated(createUserMessage('user-1', 'hello from user'))
    messageStore.handlePartUpdated(createTextPart('user-1-text-0', 'user-1', 'hello from user'))

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages).toHaveLength(1)
    expect(state?.messages[0].parts).toHaveLength(1)
    expect(state?.messages[0].parts[0]).toMatchObject({
      id: 'user-1-text-0',
      type: 'text',
      text: 'hello from user',
    })
  })

  it('reconciles a live synthetic user message with the persisted user message fetched after restart', () => {
    messageStore.handleMessageUpdated(createUserMessage('msg-live-123', 'same user text', 1000))
    messageStore.handleMessageUpdated(createUserMessage('persisted-123', 'same user text', 1150))
    messageStore.handlePartUpdated(createTextPart('persisted-123-text-0', 'persisted-123', 'same user text'))

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages).toHaveLength(1)
    expect(state?.messages[0].info).toMatchObject({ id: 'persisted-123', role: 'user' })
    expect(state?.messages[0].parts).toHaveLength(1)
    expect(state?.messages[0].parts[0]).toMatchObject({ id: 'persisted-123-text-0', text: 'same user text' })
  })

  it('deduplicates synthetic and persisted user messages when loading a merged history snapshot', () => {
    messageStore.setMessages('session-1', [
      {
        info: createUserMessage('persisted-123', 'same user text', 1150),
        parts: [createTextPart('persisted-123-text-0', 'persisted-123', 'same user text')],
      },
      {
        info: createUserMessage('msg-live-123', 'same user text', 1000),
        parts: [createTextPart('msg-live-123-text', 'msg-live-123', 'same user text')],
      },
    ])

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages).toHaveLength(1)
    expect(state?.messages[0].info.id).toBe('persisted-123')
    expect(state?.messages[0].parts).toHaveLength(1)
  })

  it('keeps messages sorted when late-fetched user messages arrive after assistant placeholders', () => {
    messageStore.handleMessageUpdated({ ...createAssistantMessage('assistant-1'), time: { created: 20 } })
    messageStore.handleMessageUpdated(createUserMessage('user-1', 'earlier user', 10))

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages.map(message => message.info.id)).toEqual(['user-1', 'assistant-1'])
  })

  it('ignores non-visible message.updated roles such as toolResult', () => {
    messageStore.handleMessageUpdated({
      id: 'tool-result-1',
      sessionID: 'session-1',
      role: 'toolResult',
      time: { created: 30, completed: 30 },
      text: 'raw tool output must stay inside the tool card',
    } as unknown as ApiMessage)

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages ?? []).toEqual([])
  })

  it('filters non-visible messages when loading historical messages', () => {
    messageStore.setMessages('session-1', [
      createMessageWithParts('assistant-1', 'visible'),
      {
        info: {
          id: 'tool-result-1',
          sessionID: 'session-1',
          role: 'toolResult',
          time: { created: 2, completed: 2 },
          text: 'raw tool output must not render as chat text',
        },
        parts: [createTextPart('tool-result-1-text', 'tool-result-1', 'raw tool output must not render as chat text')],
      } as unknown as ApiMessageWithParts,
    ])

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages.map(message => message.info.id)).toEqual(['assistant-1'])
  })

  it('marks cached sessions stale after reconnect and clears the flag after a fresh load', () => {
    messageStore.setMessages('session-1', [createMessageWithParts('message-1', 'hello')])

    expect(messageStore.isSessionStale('session-1')).toBe(false)

    messageStore.markAllSessionsStale()
    expect(messageStore.isSessionStale('session-1')).toBe(true)

    messageStore.setMessages('session-1', [createMessageWithParts('message-1', 'hello again')])
    expect(messageStore.isSessionStale('session-1')).toBe(false)
  })

  it('accepts exported message envelopes that use message instead of info', () => {
    messageStore.setMessages('session-1', [
      {
        message: createAssistantMessage('message-1'),
        parts: [createTextPart('part-message-1', 'message-1', 'hello')],
      } as unknown as ApiMessageWithParts,
    ])

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages).toHaveLength(1)
    expect(state?.messages[0].info.id).toBe('message-1')
    expect(state?.messages[0].parts[0]).toMatchObject({ id: 'part-message-1', type: 'text', text: 'hello' })
  })

  it('truncates messages after revert point', () => {
    messageStore.setMessages('session-1', [
      createMessageWithParts('message-1', 'one'),
      createMessageWithParts('message-2', 'two'),
      createMessageWithParts('message-3', 'three'),
    ])
    messageStore.setRevertState('session-1', {
      messageId: 'message-2',
      history: [],
    })

    messageStore.truncateAfterRevert('session-1')

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages).toHaveLength(1)
    expect(state?.messages[0].info.id).toBe('message-1')
    expect(state?.revertState).toBeNull()
  })

  it('removes a part from a message', () => {
    messageStore.setMessages('session-1', [createMessageWithParts('message-1', 'hello')])

    messageStore.handlePartRemoved({
      sessionID: 'session-1',
      messageID: 'message-1',
      partID: 'part-message-1',
    })

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages[0].parts).toHaveLength(0)
  })

  it('deduplicates messages in prependMessages', () => {
    messageStore.setMessages('session-1', [createMessageWithParts('message-2', 'two')])

    messageStore.prependMessages(
      'session-1',
      [createMessageWithParts('message-1', 'one'), createMessageWithParts('message-2', 'duplicate')],
      true,
    )

    const state = messageStore.getSessionState('session-1')
    expect(state?.messages).toHaveLength(2)
    expect(state?.messages[0].info.id).toBe('message-1')
    expect(state?.messages[1].info.id).toBe('message-2')
  })

  it('flushes mutable part deltas for multiple sessions in the same frame', () => {
    const rafCallbacks: Array<(time: number) => void> = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafCallbacks.push(cb as (time: number) => void)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    messageStore.setMessages('session-1', [createMessageWithParts('message-1', 'hello')])
    messageStore.setMessages('session-2', [createMessageWithParts('message-2', 'world', 'session-2')])

    const beforeMessage1 = messageStore.getSessionState('session-1')?.messages[0]
    const beforeMessage2 = messageStore.getSessionState('session-2')?.messages[0]

    messageStore.handlePartDelta({
      sessionID: 'session-1',
      messageID: 'message-1',
      partID: 'part-message-1',
      field: 'text',
      delta: '!',
    })
    messageStore.handlePartDelta({
      sessionID: 'session-2',
      messageID: 'message-2',
      partID: 'part-message-2',
      field: 'text',
      delta: '?',
    })

    const scheduledFrame = rafCallbacks[0]
    if (!scheduledFrame) {
      throw new Error('Expected requestAnimationFrame callback to be scheduled')
    }
    scheduledFrame(0)

    const afterMessage1 = messageStore.getSessionState('session-1')?.messages[0]
    const afterMessage2 = messageStore.getSessionState('session-2')?.messages[0]

    expect(afterMessage1?.parts[0]).toMatchObject({ text: 'hello!' })
    expect(afterMessage2?.parts[0]).toMatchObject({ text: 'world?' })
    expect(afterMessage1).not.toBe(beforeMessage1)
    expect(afterMessage2).not.toBe(beforeMessage2)
  })
})
