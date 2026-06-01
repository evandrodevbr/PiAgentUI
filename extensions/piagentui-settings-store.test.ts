import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPiAgentUiSettingsStore, resolvePiAgentUiSettingsPaths } from './piagentui-settings-store.js'

const tempDirs: string[] = []

function makeTempHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'piagentui-settings-store-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('PiAgentUI SQLite settings store', () => {
  it('persists namespaced settings in a SQLite database independent of browser origin', () => {
    const homeDir = makeTempHome()
    const paths = resolvePiAgentUiSettingsPaths(homeDir)
    const first = createPiAgentUiSettingsStore(paths)

    first.saveSettings({
      network: { lanAccessEnabled: true },
      stt: {
        enabled: true,
        providerKind: 'openai-compatible',
        baseUrl: 'http://127.0.0.1:8022/v1',
        transcriptionModel: 'deepdml/faster-whisper-large-v3-turbo-ct2',
        apiKeyRequired: false,
      },
      tts: {
        enabled: true,
        baseUrl: 'http://127.0.0.1:8022/v1',
        model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
        voice: 'pf_dora',
        responseFormat: 'wav',
        apiKeyRequired: false,
      },
    })
    first.close()

    const second = createPiAgentUiSettingsStore(paths)
    expect(fs.existsSync(paths.databasePath)).toBe(true)
    expect(second.getSettings()).toMatchObject({
      network: { lanAccessEnabled: true },
      stt: {
        enabled: true,
        baseUrl: 'http://127.0.0.1:8022/v1',
        transcriptionModel: 'deepdml/faster-whisper-large-v3-turbo-ct2',
        apiKeyRequired: false,
      },
      tts: {
        enabled: true,
        model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
        voice: 'pf_dora',
        responseFormat: 'wav',
        apiKeyRequired: false,
      },
    })
    second.close()
  })

  it('imports the legacy JSON settings file once into SQLite', () => {
    const homeDir = makeTempHome()
    const paths = resolvePiAgentUiSettingsPaths(homeDir)
    fs.mkdirSync(path.dirname(paths.legacyJsonPath), { recursive: true })
    fs.writeFileSync(
      paths.legacyJsonPath,
      JSON.stringify({
        network: { lanAccessEnabled: true },
        stt: {
          enabled: true,
          baseUrl: 'http://127.0.0.1:8022/v1',
          apiKey: 'legacy-secret',
          apiKeyRequired: false,
        },
      }),
      'utf8',
    )

    const store = createPiAgentUiSettingsStore(paths)
    expect(store.getSettings()).toMatchObject({
      network: { lanAccessEnabled: true },
      stt: {
        enabled: true,
        baseUrl: 'http://127.0.0.1:8022/v1',
        apiKey: 'legacy-secret',
        apiKeyRequired: false,
      },
    })
    expect(store.getMeta('legacy_json_imported_at')).toEqual(expect.any(String))
    store.close()
  })
})
