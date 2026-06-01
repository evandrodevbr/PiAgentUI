import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExtensionPanel } from './ExtensionPanel'

const getExtensionsMock = vi.fn()
const installExtensionMock = vi.fn()
const removeExtensionPackageMock = vi.fn()

vi.mock('../api/extension', () => ({
  getExtensions: (...args: unknown[]) => getExtensionsMock(...args),
  installExtension: (...args: unknown[]) => installExtensionMock(...args),
  removeExtensionPackage: (...args: unknown[]) => removeExtensionPackageMock(...args),
}))

vi.mock('../hooks', () => ({
  useDirectory: () => ({ currentDirectory: '/workspace/demo' }),
}))

vi.mock('../utils', () => ({
  apiErrorHandler: vi.fn(),
}))

describe('ExtensionPanel', () => {
  beforeEach(() => {
    getExtensionsMock.mockReset()
    installExtensionMock.mockReset()
    removeExtensionPackageMock.mockReset()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    getExtensionsMock.mockResolvedValue({
      summary: { total: 3, active: 1, inactive: 1, missing: 1, error: 0 },
      packages: [
        {
          source: 'npm:pi-hud',
          scope: 'user',
          filtered: false,
          packageName: 'pi-hud',
          version: '0.4.3',
          description: 'Persistent HUD extension',
          status: 'active',
          installedPath: '/home/user/.pi/agent/npm/node_modules/pi-hud',
          resources: {
            extensions: [{ name: 'index.ts', path: '/pkg/index.ts', enabled: true }],
            skills: [{ name: 'release', path: '/pkg/skills/release/SKILL.md', enabled: true }],
            prompts: [],
            themes: [],
          },
        },
        {
          source: 'npm:pi-muted',
          scope: 'user',
          filtered: true,
          packageName: 'pi-muted',
          version: '1.0.0',
          description: 'Disabled package',
          status: 'inactive',
          installedPath: '/home/user/.pi/agent/npm/node_modules/pi-muted',
          resources: {
            extensions: [{ name: 'muted.ts', path: '/pkg/muted.ts', enabled: false }],
            skills: [],
            prompts: [],
            themes: [],
          },
        },
        {
          source: 'npm:missing-extension',
          scope: 'project',
          filtered: false,
          status: 'missing',
          resources: { extensions: [], skills: [], prompts: [], themes: [] },
        },
      ],
    })
    installExtensionMock.mockResolvedValue({ source: 'npm:pi-new', scope: 'user', reloadRequired: true })
    removeExtensionPackageMock.mockResolvedValue({ source: 'npm:pi-hud', scope: 'user', reloadRequired: true })
  })

  it('renders installed extension packages, active state, install command, and uninstall action', async () => {
    render(<ExtensionPanel />)

    await waitFor(() => expect(screen.getByText('pi-hud')).toBeInTheDocument())

    expect(screen.getByText('(3)')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0)
    expect(screen.getByText('Persistent HUD extension')).toBeInTheDocument()
    expect(screen.getAllByText('Extensions 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Skills 1')).toBeInTheDocument()
    expect(screen.getByText('index.ts')).toBeInTheDocument()

    const installInput = screen.getByRole('textbox', { name: 'Install command' })
    fireEvent.change(installInput, { target: { value: 'pi install npm:pi-new' } })
    fireEvent.click(screen.getByRole('button', { name: 'Install extension' }))

    await waitFor(() => expect(installExtensionMock).toHaveBeenCalledWith('pi install npm:pi-new', '/workspace/demo'))
    expect(await screen.findByText('Reload Pi Agent to apply extension changes.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Uninstall pi-hud' }))
    await waitFor(() =>
      expect(removeExtensionPackageMock).toHaveBeenCalledWith('npm:pi-hud', 'user', '/workspace/demo'),
    )
  })
})
