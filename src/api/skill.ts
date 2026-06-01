// ============================================
// Skill API - Decoupled
// ============================================

import { piClient } from './piClient'
import type { SkillList } from '../types/api/skill'

/**
 * 获取所有可用 Skills
 */
export async function getSkills(_directory?: string): Promise<SkillList> {
  try {
    const data = await piClient.get<{ skills: SkillList }>('/api/skills')
    return data.skills || []
  } catch {
    return []
  }
}
