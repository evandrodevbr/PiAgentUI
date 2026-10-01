import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveData } from './downloadUtils'

vi.mock('./tauri', () => ({ isTauri: () => false }))

describe('browser file downloads', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
  })

  it('downloads exactly the requested byte view without surrounding buffer contents', async () => {
    const bytes = new Uint8Array([11, 22, 33, 44, 55])
    saveData(bytes.subarray(1, 4), 'slice.bin')

    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
    const contents = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(blob)
    })
    expect([...new Uint8Array(contents)]).toEqual([22, 33, 44])
    expect(blob.type).toBe('application/octet-stream')
  })
})
