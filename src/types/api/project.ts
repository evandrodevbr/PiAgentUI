import type {
  Project as CompatProject,
  Path as CompatPath,
} from './compat'

export type Project = CompatProject

export type ProjectIcon = NonNullable<Project['icon']>

export type ProjectCommands = NonNullable<Project['commands']>

export type ProjectUpdateParams = {
  name?: string
  icon?: {
    url?: string
    override?: string
    color?: string
  }
}

export type PathResponse = CompatPath
