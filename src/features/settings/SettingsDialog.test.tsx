import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog'

vi.mock('../../components/ui/Dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../hooks', () => ({
  useIsMobile: () => false,
}))

vi.mock('../../utils/tauri', () => ({
  isTauri: () => false,
}))

vi.mock('./components/AgentSettings', () => ({ AgentSettings: () => <div>agent-panel</div> }))
vi.mock('./components/AppearanceSettings', () => ({ AppearanceSettings: () => <div>appearance-panel</div> }))
vi.mock('./components/AboutSettings', () => ({ AboutSettings: () => <div>about-panel</div> }))
vi.mock('./components/ChatSettings', () => ({ ChatSettings: () => <div>chat-panel</div> }))
vi.mock('./components/ModelsSettings', () => ({ ModelsSettings: () => <div>models-panel</div> }))
vi.mock('./components/NotificationSettings', () => ({ NotificationSettings: () => <div>notifications-panel</div> }))
vi.mock('./components/ServiceSettings', () => ({ ServiceSettings: () => <div>service-panel</div> }))
vi.mock('./components/ServersSettings', () => ({ ServersSettings: () => <div>servers-panel</div> }))
vi.mock('./components/VoiceSettings', () => ({ VoiceSettings: () => <div>voice-panel</div> }))
vi.mock('./components/WorkspaceSettings', () => ({ WorkspaceSettings: () => <div>workspace-panel</div> }))
vi.mock('./KeybindingsSection', () => ({ KeybindingsSection: () => <div>keybindings-panel</div> }))

describe('SettingsDialog', () => {
  it('exposes voice settings as a separate settings area', () => {
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test')
    render(<SettingsDialog isOpen onClose={() => undefined} />)

    const voiceTab = screen.getByRole('tab', { name: 'Voice' })

    expect(voiceTab).toBeInTheDocument()

    fireEvent.click(voiceTab)

    expect(voiceTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('voice-panel')).toBeInTheDocument()
  })
})
