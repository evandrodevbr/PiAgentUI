import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildExtensionCatalog,
  executeExtensionInstallCommand,
  executeExtensionPackageRemoval,
  parsePiInstallCommand,
} from './piagentui-extension-manager.js'

const tempRoots: string[] = []

function makeTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'piagentui-extension-manager-'))
  tempRoots.push(root)
  return root
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('parsePiInstallCommand', () => {
  it('extracts source and local scope from a safe Pi install command', () => {
    expect(parsePiInstallCommand('pi install npm:pi-hud')).toEqual({ source: 'npm:pi-hud', local: false })
    expect(parsePiInstallCommand('pi install npm:@scope/pkg -l')).toEqual({ source: 'npm:@scope/pkg', local: true })
    expect(parsePiInstallCommand('pi install -l "D:/Projects/my extension"')).toEqual({
      source: 'D:/Projects/my extension',
      local: true,
    })
  })

  it('rejects commands that are not a single Pi install operation', () => {
    expect(() => parsePiInstallCommand('npm install pi-hud')).toThrow(/pi install/i)
    expect(() => parsePiInstallCommand('pi remove npm:pi-hud')).toThrow(/pi install/i)
    expect(() => parsePiInstallCommand('pi install npm:pi-hud && rm -rf .')).toThrow(/unsupported/i)
    expect(() => parsePiInstallCommand('pi install')).toThrow(/missing/i)
  })
})

describe('buildExtensionCatalog', () => {
  it('groups configured packages with metadata, resource counts, and active or inactive status', () => {
    const homeDir = makeTempRoot()
    const cwd = path.join(homeDir, 'project')
    const userPackageRoot = path.join(homeDir, '.pi', 'agent', 'npm', 'node_modules', 'pi-demo')
    const projectPackageRoot = path.join(cwd, '.pi', 'npm', 'node_modules', 'project-demo')
    const missingPackageSource = 'npm:missing-demo'

    writeJson(path.join(homeDir, '.pi', 'agent', 'settings.json'), {
      packages: ['npm:pi-demo', { source: missingPackageSource, extensions: [] }],
    })
    writeJson(path.join(cwd, '.pi', 'settings.json'), {
      packages: [{ source: 'npm:project-demo', extensions: [] }],
    })

    writeJson(path.join(userPackageRoot, 'package.json'), {
      name: 'pi-demo',
      version: '1.2.3',
      description: 'Demo package',
      pi: { extensions: ['./extensions'], skills: ['./skills'] },
    })
    fs.mkdirSync(path.join(userPackageRoot, 'extensions'), { recursive: true })
    fs.writeFileSync(path.join(userPackageRoot, 'extensions', 'demo.ts'), 'export default {}', 'utf8')
    fs.mkdirSync(path.join(userPackageRoot, 'skills', 'demo'), { recursive: true })
    fs.writeFileSync(path.join(userPackageRoot, 'skills', 'demo', 'SKILL.md'), '---\nname: demo\n---', 'utf8')

    writeJson(path.join(projectPackageRoot, 'package.json'), {
      name: 'project-demo',
      version: '0.1.0',
      description: 'Project package',
      pi: { extensions: ['./extensions'] },
    })
    fs.mkdirSync(path.join(projectPackageRoot, 'extensions'), { recursive: true })
    fs.writeFileSync(path.join(projectPackageRoot, 'extensions', 'project.ts'), 'export default {}', 'utf8')

    const catalog = buildExtensionCatalog({ cwd, homeDir })

    expect(catalog.summary).toEqual({ total: 3, active: 1, inactive: 1, missing: 1, error: 0 })

    const userPackage = catalog.packages.find(pkg => pkg.source === 'npm:pi-demo')
    expect(userPackage).toMatchObject({
      source: 'npm:pi-demo',
      scope: 'user',
      packageName: 'pi-demo',
      version: '1.2.3',
      description: 'Demo package',
      status: 'active',
      installedPath: userPackageRoot,
    })
    expect(userPackage?.resources.extensions).toEqual([
      expect.objectContaining({
        name: 'demo.ts',
        enabled: true,
        path: path.join(userPackageRoot, 'extensions', 'demo.ts'),
      }),
    ])
    expect(userPackage?.resources.skills).toEqual([expect.objectContaining({ name: 'demo', enabled: true })])

    const projectPackage = catalog.packages.find(pkg => pkg.source === 'npm:project-demo')
    expect(projectPackage).toMatchObject({ source: 'npm:project-demo', scope: 'project', status: 'inactive' })
    expect(projectPackage?.resources.extensions).toEqual([
      expect.objectContaining({ name: 'project.ts', enabled: false }),
    ])

    const missingPackage = catalog.packages.find(pkg => pkg.source === missingPackageSource)
    expect(missingPackage).toMatchObject({ source: missingPackageSource, scope: 'user', status: 'missing' })
  })
})

describe('extension package operations', () => {
  it('runs parsed install and removal through the Pi CLI without executing pasted shell text', async () => {
    const runner = vi.fn(async () => ({ stdout: 'ok', stderr: '' }))

    await executeExtensionInstallCommand('pi install npm:pi-hud -l', { cwd: '/repo', runner })
    await executeExtensionPackageRemoval({ source: 'npm:pi-hud', scope: 'project' }, { cwd: '/repo', runner })

    expect(runner).toHaveBeenNthCalledWith(1, ['install', 'npm:pi-hud', '-l'], { cwd: '/repo' })
    expect(runner).toHaveBeenNthCalledWith(2, ['remove', 'npm:pi-hud', '-l'], { cwd: '/repo' })
  })
})
