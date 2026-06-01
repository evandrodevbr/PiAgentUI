export type SkillSource = 'global' | 'project' | 'package' | 'other'

export interface Skill {
  name: string
  description: string
  tags?: string[]
  location?: string
  content?: string
  source?: SkillSource
}

export type SkillList = Skill[]
