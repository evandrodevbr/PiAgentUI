import type { ApiSession } from '../../api'

export interface SessionProjectGroup {
  key: string
  name: string
  directory: string
  latestUpdated: number
  sessions: ApiSession[]
}

export function normalizeProjectDirectory(directory?: string): string {
  return (directory || 'unknown').replace(/\\/g, '/').replace(/\/+$/g, '') || 'unknown'
}

export function getProjectNameFromDirectory(directory?: string): string {
  const normalized = normalizeProjectDirectory(directory)
  if (normalized === 'unknown') return 'Unknown Project'
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || normalized || 'Unknown Project'
}

function getUpdatedTime(session: ApiSession): number {
  return session.time?.updated ?? session.time?.created ?? 0
}

function sessionMatchesSearch(session: ApiSession, normalizedDirectory: string, search: string): boolean {
  if (!search) return true
  const haystack = [session.title, session.id, normalizedDirectory, getProjectNameFromDirectory(normalizedDirectory)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(search.toLowerCase())
}

export function groupSessionsByProject(sessions: ApiSession[], search = ''): SessionProjectGroup[] {
  const groups = new Map<string, SessionProjectGroup>()

  for (const session of sessions) {
    const directory = normalizeProjectDirectory(session.directory)
    if (!sessionMatchesSearch(session, directory, search.trim())) continue

    const updated = getUpdatedTime(session)
    const existing = groups.get(directory)
    if (existing) {
      existing.sessions.push(session)
      existing.latestUpdated = Math.max(existing.latestUpdated, updated)
    } else {
      groups.set(directory, {
        key: directory,
        name: getProjectNameFromDirectory(directory),
        directory,
        latestUpdated: updated,
        sessions: [session],
      })
    }
  }

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      sessions: [...group.sessions].sort((a, b) => getUpdatedTime(b) - getUpdatedTime(a)),
    }))
    .sort((a, b) => b.latestUpdated - a.latestUpdated || a.name.localeCompare(b.name))
}
