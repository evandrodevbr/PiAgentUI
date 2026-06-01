import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import { NetworkAccessSettings } from './NetworkAccessSettings'
import { getNetworkAccess, updateNetworkAccess } from '../../../api/network'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async () => 'data:image/png;base64,qr'),
  },
}))

vi.mock('../../../api/network', () => ({
  getNetworkAccess: vi.fn(),
  updateNetworkAccess: vi.fn(),
}))

describe('NetworkAccessSettings', () => {
  beforeEach(() => {
    vi.mocked(getNetworkAccess).mockReset()
    vi.mocked(updateNetworkAccess).mockReset()
  })

  it('shows LAN URL and QR code when access is enabled', async () => {
    vi.mocked(getNetworkAccess).mockResolvedValue({
      lanAccessEnabled: true,
      port: 58785,
      localUrl: 'http://127.0.0.1:58785',
      lanUrls: ['http://192.168.1.25:58785'],
      primaryLanUrl: 'http://192.168.1.25:58785',
      browserLanUrl: 'http://192.168.1.25:58785',
    })

    render(<NetworkAccessSettings />)

    expect(await screen.findByRole('link', { name: 'http://192.168.1.25:58785' })).toHaveAttribute(
      'href',
      'http://192.168.1.25:58785',
    )
    expect(await screen.findByAltText('Local network access QR code')).toBeInTheDocument()
    expect(QRCode.toDataURL).toHaveBeenCalledWith('http://192.168.1.25:58785', {
      margin: 1,
      width: 144,
    })
  })

  it('toggles LAN access through the backend', async () => {
    vi.mocked(getNetworkAccess).mockResolvedValue({
      lanAccessEnabled: false,
      port: 58785,
      localUrl: 'http://127.0.0.1:58785',
      lanUrls: ['http://192.168.1.25:58785'],
      primaryLanUrl: 'http://192.168.1.25:58785',
      browserLanUrl: 'http://192.168.1.25:58785',
    })
    vi.mocked(updateNetworkAccess).mockResolvedValue({
      lanAccessEnabled: true,
      port: 58785,
      localUrl: 'http://127.0.0.1:58785',
      lanUrls: ['http://192.168.1.25:58785'],
      primaryLanUrl: 'http://192.168.1.25:58785',
      browserLanUrl: 'http://192.168.1.25:58785',
    })

    render(<NetworkAccessSettings />)

    fireEvent.click(await screen.findByRole('button', { name: 'Enable' }))

    await waitFor(() => expect(updateNetworkAccess).toHaveBeenCalledWith(true))
    expect(await screen.findByRole('button', { name: 'Disable' })).toBeInTheDocument()
  })
})
