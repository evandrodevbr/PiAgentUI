import { describe, expect, it } from 'vitest'
import type { ApiSession } from '../../api'
import { getProjectNameFromDirectory, groupSessionsByProject } from './sessionProjectGroups'

function session(id: string, directory: string, updated: number): ApiSession {
  return {
    id,
    title: `Session ${id}`,
    directory,
    time: { created: updated, updated },
    status: { type: 'idle' },
  } as ApiSession
}

describe('sessionProjectGroups', () => {
  it('uses the basename as the project name for Windows and POSIX paths', () => {
    expect(getProjectNameFromDirectory('D:/Documents/Github/PiAgentUI/PiAgentUi')).toBe('PiAgentUi')
    expect(getProjectNameFromDirectory('/home/user/work/my-app')).toBe('my-app')
    expect(getProjectNameFromDirectory('')).toBe('Unknown Project')
  })

  it('groups sessions by normalized project directory and sorts groups by latest update', () => {
    const groups = groupSessionsByProject([
      session('old-a', 'D:/repo/app-a', 100),
      session('new-b', 'D:/repo/app-b', 400),
      session('new-a', 'D:/repo/app-a/', 300),
      session('old-b', 'D:/repo/app-b', 200),
    ])

    expect(groups.map(group => group.name)).toEqual(['app-b', 'app-a'])
    expect(groups[0].sessions.map(item => item.id)).toEqual(['new-b', 'old-b'])
    expect(groups[1].sessions.map(item => item.id)).toEqual(['new-a', 'old-a'])
  })

  it('filters groups by session title or project path when search is provided', () => {
    const groups = groupSessionsByProject(
      [session('alpha', '/work/alpha-project', 100), session('beta', '/work/beta-project', 200)],
      'alpha',
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('alpha-project')
    expect(groups[0].sessions.map(item => item.id)).toEqual(['alpha'])
  })
})
