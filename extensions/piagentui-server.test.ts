import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as nodeHttp from 'node:http'
import { spawnSync } from 'node:child_process'

const tempHomeDir = path.join(os.tmpdir(), `piagentui-test-home-${Math.random().toString(36).substring(2)}`)
fs.mkdirSync(tempHomeDir, { recursive: true })

const originalUserProfile = process.env.USERPROFILE
const originalHome = process.env.HOME

process.env.USERPROFILE = tempHomeDir
process.env.HOME = tempHomeDir

import { describe, it, expect, vi, afterAll } from 'vitest'
import serverInit from './piagentui-server.js'

describe('PiAgentUi Extension Server', () => {
  afterAll(() => {
    // Clean up temp directory
    try {
      if (fs.existsSync(tempHomeDir)) {
        fs.rmSync(tempHomeDir, { recursive: true, force: true })
      }
    } catch {
      // ignore
    }

    process.env.USERPROFILE = originalUserProfile
    process.env.HOME = originalHome
  })

  it('should initialize server, listen on a port, write discovery info, and respond to requests', async () => {
    // Mock ExtensionAPI
    const listeners: Record<string, (...args: any[]) => any> = {}
    const mockPi = {
      on: (event: string, callback: (...args: any[]) => any) => {
        listeners[event] = callback
      },
      setModel: vi.fn(),
      sendUserMessage: vi.fn(),
      getCommands: vi.fn(() => [
        {
          name: 'review',
          description: 'Run project review',
          source: 'extension',
          sourceInfo: { path: '/mock/extensions/review.ts', scope: 'project' },
        },
        {
          name: 'release',
          description: 'Use release prompt',
          source: 'prompt',
          sourceInfo: { path: '/mock/prompts/release.md', scope: 'global' },
        },
        {
          name: 'skill:test-driven-development',
          description: 'Use TDD skill',
          source: 'skill',
          sourceInfo: { path: '/mock/skills/test-driven-development/SKILL.md', scope: 'global' },
        },
      ]),
    }

    // Initialize extension server (registers event listeners on mockPi)
    serverInit(mockPi as any)

    expect(listeners['session_start']).toBeDefined()
    expect(listeners['session_shutdown']).toBeDefined()

    // Create session and skill directories
    const tempSessionDir = path.join(tempHomeDir, 'sessions')
    fs.mkdirSync(tempSessionDir, { recursive: true })

    const projectDir = path.join(tempHomeDir, 'project')
    const globalSkillFile = path.join(tempHomeDir, '.agents', 'skills', 'global-skill', 'SKILL.md')
    const projectSkillFile = path.join(projectDir, '.pi', 'skills', 'project-skill', 'SKILL.md')
    const packageSkillFile = path.join(
      tempHomeDir,
      '.pi',
      'agent',
      'npm',
      'node_modules',
      'demo-package',
      'skills',
      'package-skill',
      'SKILL.md',
    )
    const mcpConfigFile = path.join(tempHomeDir, '.pi', 'agent', 'mcp.json')
    const piSettingsFile = path.join(tempHomeDir, '.pi', 'agent', 'settings.json')
    const extensionPackageRoot = path.join(tempHomeDir, '.pi', 'agent', 'npm', 'node_modules', 'pi-demo')
    fs.mkdirSync(path.dirname(globalSkillFile), { recursive: true })
    fs.mkdirSync(path.dirname(projectSkillFile), { recursive: true })
    fs.writeFileSync(path.join(projectDir, 'README.md'), 'PiAgentUI test repo\n', 'utf8')
    spawnSync('git', ['init', '-b', 'main'], { cwd: projectDir })
    spawnSync('git', ['config', 'user.email', 'piagentui@example.test'], { cwd: projectDir })
    spawnSync('git', ['config', 'user.name', 'PiAgentUI Test'], { cwd: projectDir })
    spawnSync('git', ['add', 'README.md'], { cwd: projectDir })
    spawnSync('git', ['commit', '-m', 'initial commit'], { cwd: projectDir })
    fs.mkdirSync(path.dirname(packageSkillFile), { recursive: true })
    fs.mkdirSync(path.dirname(mcpConfigFile), { recursive: true })
    fs.mkdirSync(path.join(extensionPackageRoot, 'extensions'), { recursive: true })
    fs.writeFileSync(
      mcpConfigFile,
      JSON.stringify({
        mcpServers: {
          context7: {
            type: 'http',
            url: 'https://mcp.context7.com/mcp',
            description: 'Context7 docs',
            directTools: true,
            lifecycle: 'lazy',
          },
          localTool: {
            command: 'npx',
            args: ['local-mcp'],
          },
        },
      }),
    )
    fs.writeFileSync(piSettingsFile, JSON.stringify({ packages: ['npm:pi-demo'] }), 'utf8')
    fs.writeFileSync(
      path.join(extensionPackageRoot, 'package.json'),
      JSON.stringify({
        name: 'pi-demo',
        version: '1.0.0',
        description: 'Demo Pi extension package',
        pi: { extensions: ['./extensions'] },
      }),
      'utf8',
    )
    fs.writeFileSync(path.join(extensionPackageRoot, 'extensions', 'demo.ts'), 'export default {}', 'utf8')
    fs.writeFileSync(
      globalSkillFile,
      '---\nname: global-skill\ndescription: Global skill description\n---\n\nGlobal content',
    )
    fs.writeFileSync(
      projectSkillFile,
      '---\nname: project-skill\ndescription: Project skill description\n---\n\nProject content',
    )
    fs.writeFileSync(
      packageSkillFile,
      '---\nname: package-skill\ndescription: Package skill description\n---\n\nPackage content',
    )

    // Create a mock active session file
    const activeSessionId = 'test-session-uuid-12345'
    const sessionFile = path.join(tempSessionDir, `session_${activeSessionId}.jsonl`)
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({
        type: 'session',
        id: activeSessionId,
        timestamp: new Date().toISOString(),
        cwd: '/mock/cwd',
      }) + '\n',
    )

    const otherSessionId = 'test-session-uuid-other'
    const otherSessionFile = path.join(tempSessionDir, `session_${otherSessionId}.jsonl`)
    fs.writeFileSync(
      otherSessionFile,
      JSON.stringify({
        type: 'session',
        id: otherSessionId,
        timestamp: new Date().toISOString(),
        cwd: '/mock/cwd',
      }) +
        '\n' +
        JSON.stringify({
          type: 'message',
          id: 'other-user-1',
          message: { role: 'user', content: [{ type: 'text', text: 'Investigate Docker access' }] },
        }) +
        '\n',
    )

    const namedSessionId = 'named-session-uuid'
    const namedSessionFile = path.join(tempSessionDir, `session_${namedSessionId}.jsonl`)
    fs.writeFileSync(
      namedSessionFile,
      JSON.stringify({
        type: 'session',
        id: namedSessionId,
        timestamp: new Date().toISOString(),
        cwd: '/mock/cwd',
      }) +
        '\n' +
        JSON.stringify({ type: 'session_info', id: 'named-info-1', name: 'Manual Session Name' }) +
        '\n' +
        JSON.stringify({
          type: 'message',
          id: 'named-user-1',
          message: { role: 'user', content: [{ type: 'text', text: 'This should not be the title' }] },
        }) +
        '\n',
    )

    const noopSessionId = 'noop-session-uuid'
    const noopSessionFile = path.join(tempSessionDir, `session_${noopSessionId}.jsonl`)
    fs.writeFileSync(
      noopSessionFile,
      JSON.stringify({
        type: 'session',
        id: noopSessionId,
        timestamp: new Date().toISOString(),
        cwd: '/mock/cwd',
      }) + '\n',
    )

    const cancelledSessionId = 'test-session-uuid-cancelled'
    const cancelledSessionFile = path.join(tempSessionDir, `session_${cancelledSessionId}.jsonl`)
    fs.writeFileSync(
      cancelledSessionFile,
      JSON.stringify({
        type: 'session',
        id: cancelledSessionId,
        timestamp: new Date().toISOString(),
        cwd: '/mock/cwd',
      }) + '\n',
    )

    const replacedSendUserMessage = vi.fn()
    const replacedSetModel = vi.fn()
    const switchSession = vi.fn(
      async (sessionPath: string, options?: { withSession?: (ctx: any) => Promise<void> }) => {
        await listeners['session_shutdown']?.({ reason: 'resume' })
        const sessionIdFromPath =
          path
            .basename(sessionPath)
            .replace(/\.jsonl$/, '')
            .split('_')
            .pop() || otherSessionId
        await options?.withSession?.({
          ...mockContext,
          sessionManager: {
            getSessionDir: () => tempSessionDir,
            getSessionId: () => sessionIdFromPath,
          },
          model: undefined,
          setModel: replacedSetModel,
          sendUserMessage: replacedSendUserMessage,
        })
        return { cancelled: false }
      },
    )

    // Mock ExtensionContext
    const mockContext = {
      sessionManager: {
        getSessionDir: () => tempSessionDir,
        getSessionId: () => activeSessionId,
      },
      modelRegistry: {
        getAvailable: () => [
          {
            id: 'gemini-2.5-pro',
            name: 'Gemini 2.5 Pro',
            provider: 'google',
            contextWindow: 200000,
            maxOutputTokens: 64000,
            reasoning: true,
            input: ['text', 'image'],
          },
          {
            id: 'legacy-max-tokens-model',
            name: 'Legacy Max Tokens Model',
            provider: 'anthropic',
            contextWindow: 300000,
            maxTokens: 32000,
          },
        ],
        getAll: () => [],
        find: (provider: string, id: string) => ({ id, provider, name: id }),
      },
      model: {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'google',
        contextWindow: 200000,
        maxOutputTokens: 64000,
      },
      setModel: vi.fn(),
      cwd: projectDir,
      isIdle: () => true,
      getContextUsage: vi.fn(() => ({ tokens: 42000, contextWindow: 200000, percent: 21 })),
      getSystemPrompt: vi.fn(
        () => `<available_skills>
  <skill><name>global-skill</name><description>Global skill description</description><location>${globalSkillFile}</location></skill>
  <skill><name>project-skill</name><description>Project skill description</description><location>${projectSkillFile}</location></skill>
  <skill><name>package-skill</name><description>Package skill description</description><location>${packageSkillFile}</location></skill>
</available_skills>`,
      ),
      abort: vi.fn(),
      switchSession,
      ui: {
        setWidget: vi.fn(),
      },
    }

    // Trigger session_start
    await listeners['session_start']({}, mockContext)

    // Wait for the async server.listen callback to run and write connection info
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify widget is set
    expect(mockContext.ui.setWidget).toHaveBeenCalledWith(
      'piagentui-link',
      expect.arrayContaining([expect.stringContaining('PiAgentUI Web:')]),
      expect.objectContaining({ placement: 'belowEditor' }),
    )

    // Verify piagentui-port.json exists in temp home dir
    const discoveryPath = path.join(tempHomeDir, '.pi', 'agent', 'piagentui-port.json')
    expect(fs.existsSync(discoveryPath)).toBe(true)

    // Read discovery data
    const discoveryData = JSON.parse(fs.readFileSync(discoveryPath, 'utf8'))
    const { port, token } = discoveryData
    expect(port).toBeGreaterThan(0)
    expect(token).toBeDefined()

    const baseUrl = `http://127.0.0.1:${port}`

    // 1. Test /global/health
    const healthRes = await fetch(`${baseUrl}/global/health`)
    expect(healthRes.status).toBe(200)
    const healthData = await healthRes.json()
    expect(healthData).toEqual({ status: 'ok', pi: 'ready' })

    // 2. Test unauthorized endpoint
    const unauthRes = await fetch(`${baseUrl}/api/models`)
    expect(unauthRes.status).toBe(401)

    // 3. Test /api/models with correct token
    const modelsRes = await fetch(`${baseUrl}/api/models`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(modelsRes.status).toBe(200)
    const modelsData = (await modelsRes.json()) as any
    expect(modelsData.models).toBeDefined()
    expect(modelsData.models[0].id).toBe('gemini-2.5-pro')
    expect(modelsData.models[0].contextLimit).toBe(200000)
    expect(modelsData.models[0].outputLimit).toBe(64000)

    const legacyModel = modelsData.models.find((model: any) => model.id === 'legacy-max-tokens-model')
    expect(legacyModel.contextLimit).toBe(300000)
    expect(legacyModel.outputLimit).toBe(32000)

    // 4. Test /api/network/access
    const networkRes = await fetch(`${baseUrl}/api/network/access`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(networkRes.status).toBe(200)
    const networkData = (await networkRes.json()) as any
    expect(networkData).toMatchObject({
      lanAccessEnabled: false,
      port,
      localUrl: `http://127.0.0.1:${port}`,
    })
    expect(Array.isArray(networkData.lanUrls)).toBe(true)

    const networkEnableRes = await fetch(`${baseUrl}/api/network/access`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lanAccessEnabled: true }),
    })
    expect(networkEnableRes.status).toBe(200)
    const networkEnableData = (await networkEnableRes.json()) as any
    expect(networkEnableData.lanAccessEnabled).toBe(true)
    if (networkEnableData.primaryLanUrl) {
      expect(networkEnableData.browserLanUrl).toBe(networkEnableData.primaryLanUrl)
      expect(networkEnableData.browserLanUrl).not.toContain('token=')
    }

    const lanModelsRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = nodeHttp.request(
        {
          host: '127.0.0.1',
          port,
          path: '/api/models',
          method: 'GET',
          headers: { Host: `192.168.1.25:${port}` },
        },
        response => {
          let body = ''
          response.setEncoding('utf8')
          response.on('data', chunk => {
            body += chunk
          })
          response.on('end', () => resolve({ status: response.statusCode || 0, body }))
        },
      )
      req.on('error', reject)
      req.end()
    })
    expect(lanModelsRes.status).toBe(200)

    const lanPageRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = nodeHttp.request(
        {
          host: '127.0.0.1',
          port,
          path: '/',
          method: 'GET',
          headers: { Host: `192.168.1.25:${port}` },
        },
        response => {
          let body = ''
          response.setEncoding('utf8')
          response.on('data', chunk => {
            body += chunk
          })
          response.on('end', () => resolve({ status: response.statusCode || 0, body }))
        },
      )
      req.on('error', reject)
      req.end()
    })
    expect(lanPageRes.status).toBe(200)
    expect(lanPageRes.body).toContain('token: null')

    // 5. Test STT settings and file transcription without leaking API key
    const sttSettingsRes = await fetch(`${baseUrl}/api/settings/stt`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(sttSettingsRes.status).toBe(200)
    const initialSttSettings = (await sttSettingsRes.json()) as any
    expect(initialSttSettings.apiKeyConfigured).toBe(false)
    expect(initialSttSettings.apiKey).toBeUndefined()

    const saveSttRes = await fetch(`${baseUrl}/api/settings/stt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        providerKind: 'openai-compatible',
        mode: 'file',
        baseUrl: 'https://api.openai.test/v1',
        apiKey: 'secret-stt-key',
        transcriptionEndpoint: '/audio/transcriptions',
        transcriptionModel: 'gpt-4o-mini-transcribe',
        language: 'pt',
        insertMode: 'append',
      }),
    })
    expect(saveSttRes.status).toBe(200)
    const savedSttSettings = (await saveSttRes.json()) as any
    expect(savedSttSettings.apiKeyConfigured).toBe(true)
    expect(savedSttSettings.apiKey).toBeUndefined()

    const originalFetch = globalThis.fetch
    const providerFetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const target = String(input)
      if (target === 'https://api.openai.test/v1/audio/transcriptions') {
        expect(init?.method).toBe('POST')
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer secret-stt-key')
        const body = init?.body as FormData
        expect(body.get('model')).toBe('gpt-4o-mini-transcribe')
        expect(body.get('language')).toBe('pt')
        expect(body.get('file')).toBeInstanceOf(File)
        return new Response(JSON.stringify({ text: 'texto transcrito' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return originalFetch.call(globalThis, input, init)
    })
    globalThis.fetch = providerFetch as typeof fetch
    try {
      const boundary = '----piagentui-test-boundary'
      const multipartBody = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="voice.webm"',
        'Content-Type: audio/webm',
        '',
        'audio',
        `--${boundary}--`,
        '',
      ].join('\r\n')
      const transcriptionRes = await originalFetch.call(globalThis, `${baseUrl}/api/stt/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(Buffer.byteLength(multipartBody)),
        },
        body: multipartBody,
      })
      expect(transcriptionRes.status).toBe(200)
      const transcriptionData = (await transcriptionRes.json()) as any
      expect(transcriptionData).toMatchObject({
        text: 'texto transcrito',
        provider: 'openai-compatible',
        model: 'gpt-4o-mini-transcribe',
      })
      expect(providerFetch).toHaveBeenCalledWith(
        'https://api.openai.test/v1/audio/transcriptions',
        expect.objectContaining({ method: 'POST' }),
      )
    } finally {
      globalThis.fetch = originalFetch
    }

    const keylessSttRes = await fetch(`${baseUrl}/api/settings/stt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        providerKind: 'openai-compatible',
        baseUrl: 'http://127.0.0.1:8022/v1',
        apiKey: null,
        apiKeyRequired: false,
        transcriptionEndpoint: '/audio/transcriptions',
        transcriptionModel: 'deepdml/faster-whisper-large-v3-turbo-ct2',
      }),
    })
    expect(keylessSttRes.status).toBe(200)
    const keylessSttSettings = (await keylessSttRes.json()) as any
    expect(keylessSttSettings.apiKeyConfigured).toBe(false)
    expect(keylessSttSettings.apiKeyRequired).toBe(false)

    const keylessFetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const target = String(input)
      if (target === 'http://127.0.0.1:8022/v1/audio/transcriptions') {
        expect(init?.headers).toEqual({})
        return new Response(JSON.stringify({ text: 'sem chave' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return originalFetch.call(globalThis, input, init)
    })
    globalThis.fetch = keylessFetch as typeof fetch
    try {
      const boundary = '----piagentui-keyless-boundary'
      const multipartBody = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="voice.webm"',
        'Content-Type: audio/webm',
        '',
        'audio',
        `--${boundary}--`,
        '',
      ].join('\r\n')
      const keylessTranscriptionRes = await originalFetch.call(globalThis, `${baseUrl}/api/stt/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(Buffer.byteLength(multipartBody)),
        },
        body: multipartBody,
      })
      expect(keylessTranscriptionRes.status).toBe(200)
      expect(await keylessTranscriptionRes.json()).toMatchObject({ text: 'sem chave' })
    } finally {
      globalThis.fetch = originalFetch
    }

    const saveTtsRes = await fetch(`${baseUrl}/api/settings/tts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        baseUrl: 'http://127.0.0.1:8022/v1',
        apiKeyRequired: false,
        speechEndpoint: '/audio/speech',
        model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
        voice: 'pf_dora',
        responseFormat: 'wav',
      }),
    })
    expect(saveTtsRes.status).toBe(200)
    const savedTtsSettings = (await saveTtsRes.json()) as any
    expect(savedTtsSettings).toMatchObject({
      enabled: true,
      apiKeyConfigured: false,
      apiKeyRequired: false,
      voice: 'pf_dora',
      responseFormat: 'wav',
    })

    const invalidSttRes = await fetch(`${baseUrl}/api/settings/stt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'file:///tmp/secrets' }),
    })
    expect(invalidSttRes.status).toBe(400)

    // 6. Test /api/commands/list with built-in and dynamic Pi commands
    const commandsRes = await fetch(`${baseUrl}/api/commands/list`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(commandsRes.status).toBe(200)
    const commandsData = (await commandsRes.json()) as any
    expect(commandsData.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'settings', apiSource: 'builtin', category: 'general' }),
        expect.objectContaining({ name: 'model', apiSource: 'builtin', category: 'model' }),
        expect.objectContaining({ name: 'compact', apiSource: 'builtin', category: 'context' }),
        expect.objectContaining({
          name: 'review',
          description: 'Run project review',
          apiSource: 'extension',
          category: 'extension',
        }),
        expect.objectContaining({ name: 'release', apiSource: 'prompt', category: 'prompt' }),
        expect.objectContaining({ name: 'skill:test-driven-development', apiSource: 'skill', category: 'skill' }),
      ]),
    )
    expect(commandsData.groups).toMatchObject({ builtin: 21, extension: 1, prompt: 1, skill: 1 })

    // 5. Test /api/skills with real Pi prompt metadata
    const skillsRes = await fetch(`${baseUrl}/api/skills`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(skillsRes.status).toBe(200)
    const skillsData = (await skillsRes.json()) as any
    expect(skillsData.skills.map((skill: any) => [skill.name, skill.source])).toEqual([
      ['global-skill', 'global'],
      ['project-skill', 'project'],
      ['package-skill', 'package'],
    ])
    expect(skillsData.skills[0].content).toContain('Global content')
    expect(skillsData.groups).toMatchObject({ global: 1, project: 1, package: 1, other: 0 })

    // 5. Test /api/mcp/status with real local config metadata
    const mcpRes = await fetch(`${baseUrl}/api/mcp/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(mcpRes.status).toBe(200)
    const mcpData = (await mcpRes.json()) as any
    expect(mcpData.configPaths).toEqual([mcpConfigFile])
    expect(mcpData.servers.context7).toMatchObject({
      status: 'configured',
      transport: 'http',
      source: 'global',
      url: 'https://mcp.context7.com/mcp',
      directTools: true,
      lifecycle: 'lazy',
    })
    expect(mcpData.servers.localTool).toMatchObject({
      status: 'configured',
      transport: 'stdio',
      command: 'npx',
      args: ['local-mcp'],
    })

    // 6. Test /api/extensions with configured Pi packages and active resource info
    const extensionsRes = await fetch(`${baseUrl}/api/extensions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(extensionsRes.status).toBe(200)
    const extensionsData = (await extensionsRes.json()) as any
    expect(extensionsData.summary).toMatchObject({ total: 1, active: 1, inactive: 0, missing: 0, error: 0 })
    expect(extensionsData.packages).toEqual([
      expect.objectContaining({
        source: 'npm:pi-demo',
        scope: 'user',
        packageName: 'pi-demo',
        version: '1.0.0',
        description: 'Demo Pi extension package',
        status: 'active',
        resources: expect.objectContaining({
          extensions: [expect.objectContaining({ name: 'demo.ts', enabled: true })],
        }),
      }),
    ])

    fs.writeFileSync(path.join(projectDir, 'git-control.txt'), 'changed\n', 'utf8')

    const vcsStatusRes = await fetch(`${baseUrl}/api/vcs/status?directory=${encodeURIComponent(projectDir)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(vcsStatusRes.status).toBe(200)
    const vcsStatusData = (await vcsStatusRes.json()) as any
    expect(vcsStatusData).toMatchObject({ branch: 'main', dirty: true, ahead: 0, behind: 0 })
    expect(vcsStatusData.files).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'git-control.txt', untracked: true })]),
    )

    const vcsBranchesRes = await fetch(`${baseUrl}/api/vcs/branches?directory=${encodeURIComponent(projectDir)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(vcsBranchesRes.status).toBe(200)
    const vcsBranchesData = (await vcsBranchesRes.json()) as any
    expect(vcsBranchesData).toMatchObject({ current: 'main' })
    expect(vcsBranchesData.branches).toEqual([expect.objectContaining({ name: 'main', current: true, remote: false })])

    const stageRes = await fetch(`${baseUrl}/api/vcs/stage?directory=${encodeURIComponent(projectDir)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: ['git-control.txt'] }),
    })
    expect(stageRes.status).toBe(200)

    const commitRes = await fetch(`${baseUrl}/api/vcs/commit?directory=${encodeURIComponent(projectDir)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test: add git control fixture' }),
    })
    expect(commitRes.status).toBe(200)
    expect(await commitRes.json()).toMatchObject({ ok: true })

    // 7. Test /api/sessions/:sessionId/context
    const contextRes = await fetch(`${baseUrl}/api/sessions/${activeSessionId}/context`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(contextRes.status).toBe(200)
    const contextData = (await contextRes.json()) as any
    expect(contextData).toMatchObject({
      available: true,
      sessionId: activeSessionId,
      tokens: 42000,
      contextWindow: 200000,
      percent: 21,
      providerID: 'google',
      modelID: 'gemini-2.5-pro',
      modelName: 'Gemini 2.5 Pro',
      outputLimit: 64000,
    })

    const inactiveContextRes = await fetch(`${baseUrl}/api/sessions/${otherSessionId}/context`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(inactiveContextRes.status).toBe(200)
    const inactiveContextData = (await inactiveContextRes.json()) as any
    expect(inactiveContextData).toMatchObject({
      available: false,
      sessionId: otherSessionId,
      activeSessionId,
      reason: 'session_not_active',
    })

    // 5. Test /api/sessions (GET)
    const getSessionsRes = await fetch(`${baseUrl}/api/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(getSessionsRes.status).toBe(200)
    const getSessionsData = (await getSessionsRes.json()) as any
    expect(getSessionsData.sessions).toBeDefined()
    expect(getSessionsData.sessions.map((session: any) => session.id)).toEqual(
      expect.arrayContaining([activeSessionId, otherSessionId, namedSessionId, noopSessionId]),
    )
    const sessionsById = new Map<string, any>(getSessionsData.sessions.map((session: any) => [session.id, session]))
    expect(sessionsById.get(otherSessionId)?.title).toBe('Investigate Docker access')
    expect(sessionsById.get(namedSessionId)?.title).toBe('Manual Session Name')
    expect(sessionsById.get(noopSessionId)?.title).toBe('Session noop-ses')

    // 6. Test /api/sessions (POST) creates a real Pi session and switches to it
    const createSessionRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory: projectDir, title: 'Fresh Real Session' }),
    })
    expect(createSessionRes.status).toBe(200)
    const createSessionData = (await createSessionRes.json()) as any
    expect(createSessionData.id).not.toBe(activeSessionId)
    expect(createSessionData.title).toBe('Fresh Real Session')
    expect(createSessionData.directory).toBe(projectDir)
    const createdSessionFiles = fs
      .readdirSync(tempSessionDir)
      .filter(file => file.endsWith(`_${createSessionData.id}.jsonl`))
    expect(createdSessionFiles).toHaveLength(1)
    const createdSessionContent = fs.readFileSync(path.join(tempSessionDir, createdSessionFiles[0]), 'utf8')
    expect(createdSessionContent).toContain('"type":"session"')
    expect(createdSessionContent).toContain('"version":3')
    expect(createdSessionContent).toContain(`"cwd":"${projectDir.replace(/\\/g, '\\\\')}"`)
    expect(createdSessionContent).toContain('Fresh Real Session')
    expect(switchSession).toHaveBeenCalledWith(
      path.join(tempSessionDir, createdSessionFiles[0]),
      expect.objectContaining({ withSession: expect.any(Function) }),
    )
    switchSession.mockClear()

    // 7. Test /api/sessions/abort (POST)
    const abortRes = await fetch(`${baseUrl}/api/sessions/abort`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(abortRes.status).toBe(200)
    const abortData = (await abortRes.json()) as any
    expect(abortData).toEqual({ status: 'aborted' })
    expect(mockContext.abort).toHaveBeenCalled()

    // 8. Test /api/messages/send (POST)
    const sendRes = await fetch(`${baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'hello world',
        model: { providerID: 'google', modelID: 'gemini-2.5-pro' },
      }),
    })
    expect(sendRes.status).toBe(202)
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith('hello world')
    expect(switchSession).not.toHaveBeenCalled()

    const sendOtherRes = await fetch(`${baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: otherSessionId,
        text: 'hello other session',
        model: { providerID: 'google', modelID: 'gemini-2.5-pro' },
      }),
    })
    expect(sendOtherRes.status).toBe(202)
    expect(switchSession).toHaveBeenCalledWith(
      otherSessionFile,
      expect.objectContaining({
        withSession: expect.any(Function),
      }),
    )
    expect(replacedSetModel).toHaveBeenCalledWith({ id: 'gemini-2.5-pro', provider: 'google', name: 'gemini-2.5-pro' })
    expect(replacedSendUserMessage).toHaveBeenCalledWith('hello other session')
    expect(fs.existsSync(discoveryPath)).toBe(true)

    const missingSessionRes = await fetch(`${baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'missing-session-id',
        text: 'must not be sent',
        model: { providerID: 'google', modelID: 'gemini-2.5-pro' },
      }),
    })
    expect(missingSessionRes.status).toBe(404)
    expect(replacedSendUserMessage).not.toHaveBeenCalledWith('must not be sent')

    switchSession.mockImplementationOnce(async sessionPath => {
      expect(sessionPath).toBe(noopSessionFile)
      return { cancelled: false }
    })
    const noopSwitchRes = await fetch(`${baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: noopSessionId,
        text: 'must not falsely succeed',
        model: { providerID: 'google', modelID: 'gemini-2.5-pro' },
      }),
    })
    expect(noopSwitchRes.status).toBe(501)
    expect(replacedSendUserMessage).not.toHaveBeenCalledWith('must not falsely succeed')

    switchSession.mockImplementationOnce(async sessionPath => {
      expect(sessionPath).toBe(cancelledSessionFile)
      return { cancelled: true }
    })
    const cancelledSwitchRes = await fetch(`${baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: cancelledSessionId,
        text: 'must not be sent after cancellation',
        model: { providerID: 'google', modelID: 'gemini-2.5-pro' },
      }),
    })
    expect(cancelledSwitchRes.status).toBe(409)
    expect(replacedSendUserMessage).not.toHaveBeenCalledWith('must not be sent after cancellation')

    // 9. Test /api/sessions/:sessionId/messages (GET) with tool formatting
    // Let's write some message content to the JSONL file first
    fs.appendFileSync(
      sessionFile,
      JSON.stringify({
        type: 'message',
        id: 'msg-user-1',
        message: { role: 'user', content: [{ type: 'text', text: 'run command' }], timestamp: Date.now() },
      }) + '\n',
    )

    fs.appendFileSync(
      sessionFile,
      JSON.stringify({
        type: 'message',
        id: 'msg-assistant-1',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'sure' },
            { type: 'toolCall', id: 'tool-call-123', name: 'run_command', arguments: { command: 'echo hello' } },
            { type: 'toolCall', id: 'tool-call-456', name: 'run_command', arguments: { command: 'echo chained' } },
            { type: 'toolCall', id: 'tool-call-789', name: 'run_command', arguments: { command: 'echo error' } },
          ],
          timestamp: Date.now(),
        },
      }) + '\n',
    )

    fs.appendFileSync(
      sessionFile,
      JSON.stringify({
        type: 'message',
        id: 'tool-result-123',
        parentId: 'msg-assistant-1',
        message: {
          role: 'toolResult',
          toolCallId: 'tool-call-123',
          toolName: 'run_command',
          content: 'hello',
          isError: false,
        },
      }) + '\n',
    )

    fs.appendFileSync(
      sessionFile,
      JSON.stringify({
        type: 'message',
        id: 'tool-result-456',
        parentId: 'tool-result-123',
        message: {
          role: 'toolResult',
          toolCallId: 'tool-call-456',
          toolName: 'run_command',
          content: [{ type: 'text', text: 'chained output' }],
          isError: false,
        },
      }) + '\n',
    )

    fs.appendFileSync(
      sessionFile,
      JSON.stringify({
        type: 'message',
        id: 'tool-result-789',
        parentId: 'tool-result-456',
        message: {
          role: 'toolResult',
          toolCallId: 'tool-call-789',
          toolName: 'run_command',
          content: [{ type: 'text', text: 'chained failure' }],
          isError: true,
        },
      }) + '\n',
    )

    const messagesRes = await fetch(`${baseUrl}/api/sessions/${activeSessionId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(messagesRes.status).toBe(200)
    const messagesData = (await messagesRes.json()) as any
    expect(messagesData.messages).toBeDefined()
    expect(messagesData.messages.length).toBe(2)
    expect(messagesData.messages.every((message: any) => message.info.role !== 'toolResult')).toBe(true)

    // Verify tool part mapping has both id and callID and chained toolResult entries attach by toolCallId.
    const assistantMsg = messagesData.messages[1]
    const toolsById = new Map(assistantMsg.parts.filter((p: any) => p.type === 'tool').map((p: any) => [p.id, p]))
    const toolPart = toolsById.get('tool-call-123') as any
    expect(toolPart).toBeDefined()
    expect(toolPart.id).toBe('tool-call-123')
    expect(toolPart.callID).toBe('tool-call-123')
    expect(toolPart.state.status).toBe('completed')
    expect(toolPart.state.output).toBe('hello')

    const chainedToolPart = toolsById.get('tool-call-456') as any
    expect(chainedToolPart.state.status).toBe('completed')
    expect(chainedToolPart.state.output).toBe('chained output')

    const failedChainedToolPart = toolsById.get('tool-call-789') as any
    expect(failedChainedToolPart.state.status).toBe('error')
    expect(failedChainedToolPart.state.output).toBe('chained failure')
    expect(failedChainedToolPart.state.error).toBe('chained failure')

    // 10. Test SSE Event Stream (/global/event)
    const eventsRes = await fetch(`${baseUrl}/global/event`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(eventsRes.status).toBe(200)
    const reader = eventsRes.body?.getReader()
    expect(reader).toBeDefined()

    // Read initial server.connected event
    const chunk1 = await reader?.read()
    const text1 = new TextDecoder().decode(chunk1?.value)
    expect(text1).toContain('server.connected')

    // Trigger new session creation
    const nextSessionId = 'test-session-uuid-56789'
    const nextSessionFile = path.join(tempSessionDir, `session_${nextSessionId}.jsonl`)
    fs.writeFileSync(
      nextSessionFile,
      JSON.stringify({
        type: 'session',
        id: nextSessionId,
        timestamp: new Date().toISOString(),
        cwd: '/mock/cwd',
      }) + '\n',
    )

    const nextMockContext = {
      ...mockContext,
      sessionManager: {
        getSessionDir: () => tempSessionDir,
        getSessionId: () => nextSessionId,
      },
    }

    // Trigger session_start for the new session - should broadcast session.created!
    await listeners['session_start']({}, nextMockContext as any)
    const chunk2 = await reader?.read()
    const text2 = new TextDecoder().decode(chunk2?.value)
    expect(text2).toContain('session.created')
    expect(text2).toContain(nextSessionId)

    // Trigger agent_start - should broadcast session.status and session.updated!
    await listeners['agent_start']()
    const chunk3 = await reader?.read()
    const text3 = new TextDecoder().decode(chunk3?.value)
    expect(text3).toContain('session.status')
    expect(text3).toContain('working')
    expect(text3).toContain('session.updated')

    // Close reader stream
    await reader?.cancel()

    // Trigger session_shutdown
    await listeners['session_shutdown']({})

    // Verify discovery file is deleted
    expect(fs.existsSync(discoveryPath)).toBe(false)
  })
})
