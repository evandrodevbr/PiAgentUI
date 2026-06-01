import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSkills } from './skill'
import { piClient } from './piClient'

vi.mock('./piClient', () => ({
  piClient: {
    get: vi.fn(),
  },
}))

describe('getSkills', () => {
  beforeEach(() => {
    vi.mocked(piClient.get).mockReset()
  })

  it('preserves real skill source metadata from the backend', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      skills: [
        {
          name: 'global-skill',
          description: 'Global skill',
          location: '/home/user/.agents/skills/global-skill/SKILL.md',
          source: 'global',
          content: 'global content',
        },
      ],
      groups: { global: 1, project: 0, package: 0, other: 0 },
    })

    const skills = await getSkills('/workspace/demo')

    expect(piClient.get).toHaveBeenCalledWith('/api/skills')
    expect(skills[0]).toMatchObject({ name: 'global-skill', source: 'global' })
  })
})
