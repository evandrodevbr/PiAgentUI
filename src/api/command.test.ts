import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCommands } from './command'
import { piClient } from './piClient'

vi.mock('./piClient', () => ({
  piClient: {
    get: vi.fn(),
  },
}))

vi.mock('../store/serverStore', () => ({
  serverStore: {
    getActiveServerId: () => 'test-server',
  },
}))

describe('getCommands', () => {
  beforeEach(() => {
    vi.mocked(piClient.get).mockReset()
  })

  it('marks frontend and api commands with stable sources', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      commands: [{ name: 'review', description: 'Run project review' }],
    })

    const commands = await getCommands('/workspace/project')

    expect(commands).toEqual([
      { name: 'review', description: 'Run project review', source: 'api' },
      { name: 'new', description: 'Create a new chat session', source: 'frontend' },
      { name: 'compact', description: 'Compact session by summarizing conversation history', source: 'frontend' },
    ])
  })

  it('keeps API commands as api commands even if names overlap frontend commands', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      commands: [{ name: 'compact', description: 'Native compact command' }],
    })

    const commands = await getCommands('/workspace/project-overlap')

    expect(commands).toEqual([
      { name: 'compact', description: 'Native compact command', source: 'api' },
      { name: 'new', description: 'Create a new chat session', source: 'frontend' },
    ])
  })

  it('keeps local UI handlers for built-in commands that are already implemented in the frontend', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      commands: [
        { name: 'new', description: 'Native new command', apiSource: 'builtin' },
        { name: 'compact', description: 'Native compact command', apiSource: 'builtin' },
        { name: 'model', description: 'Select model', apiSource: 'builtin' },
      ],
    })

    const commands = await getCommands('/workspace/project-builtins')

    expect(commands).toEqual([
      { name: 'model', description: 'Select model', apiSource: 'builtin', source: 'api' },
      { name: 'new', description: 'Create a new chat session', source: 'frontend' },
      { name: 'compact', description: 'Compact session by summarizing conversation history', source: 'frontend' },
    ])
  })
})
