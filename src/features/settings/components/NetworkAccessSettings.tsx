import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getNetworkAccess, updateNetworkAccess } from '../../../api/network'
import type { NetworkAccessInfo } from '../../../types/api/network'

export function NetworkAccessSettings() {
  const [info, setInfo] = useState<NetworkAccessInfo | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getNetworkAccess()
      .then(data => {
        if (!cancelled) setInfo(data)
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load local network access settings')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const url = info?.browserLanUrl || info?.primaryLanUrl
    if (!url || !info?.lanAccessEnabled) {
      setQrDataUrl('')
      return
    }

    QRCode.toDataURL(url, { margin: 1, width: 144 })
      .then(dataUrl => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })

    return () => {
      cancelled = true
    }
  }, [info?.browserLanUrl, info?.primaryLanUrl, info?.lanAccessEnabled])

  async function toggleLanAccess() {
    if (!info) return
    setIsSaving(true)
    setError('')
    try {
      setInfo(await updateNetworkAccess(!info.lanAccessEnabled))
    } catch {
      setError('Unable to update local network access')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border-200/40 bg-bg-050 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[length:var(--fs-md)] font-medium text-text-100">Local network access</div>
          <div className="mt-1 text-[length:var(--fs-xs)] text-text-400 leading-relaxed">
            Share this PiAgentUI instance with devices on your local network. Keep it disabled when you do not need it.
          </div>
        </div>
        <button
          type="button"
          onClick={toggleLanAccess}
          disabled={!info || isSaving}
          className={`px-3 py-1.5 rounded-md text-[length:var(--fs-xs)] font-medium transition-colors ${
            info?.lanAccessEnabled
              ? 'bg-warning-100/15 text-warning-100 hover:bg-warning-100/20'
              : 'bg-accent-main-100/15 text-accent-main-100 hover:bg-accent-main-100/20'
          } disabled:opacity-50`}
        >
          {isSaving ? 'Saving…' : info?.lanAccessEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      {info?.lanAccessEnabled && (
        <div className="rounded-md border border-warning-100/20 bg-warning-bg/40 p-3 space-y-3">
          <p className="text-[length:var(--fs-xs)] text-warning-100 leading-relaxed">
            Anyone who can open this URL on your network can control the agent. Use only on trusted networks.
          </p>
          {info.primaryLanUrl ? (
            <div className="flex items-center gap-3">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="Local network access QR code" className="w-28 h-28 rounded bg-white p-1" />
              )}
              <div className="min-w-0">
                <div className="text-[length:var(--fs-xs)] text-text-400">Open from another device:</div>
                <a
                  className="block mt-1 text-[length:var(--fs-sm)] text-text-100 break-all underline decoration-border-300 underline-offset-2 hover:text-accent-main-100"
                  href={info.browserLanUrl || info.primaryLanUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {info.browserLanUrl || info.primaryLanUrl}
                </a>
              </div>
            </div>
          ) : (
            <p className="text-[length:var(--fs-xs)] text-text-400">No LAN IPv4 address was detected.</p>
          )}
        </div>
      )}

      {error && <p className="text-[length:var(--fs-xs)] text-danger-100">{error}</p>}
    </div>
  )
}
