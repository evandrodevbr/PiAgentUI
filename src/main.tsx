import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './index.css'
import './i18n'
import { initOverlayScrollbars } from './lib/overlayScrollbar'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { DirectoryProvider, SessionProvider } from './contexts'
import { themeStore } from './store/themeStore'
import { serverStore } from './store/serverStore'
import { messageStore } from './store/messageStore'
import { childSessionStore } from './store/childSessionStore'
import { todoStore } from './store/todoStore'
import { autoApproveStore } from './store/autoApproveStore'
import { serviceStore } from './store/serviceStore'
import { reconnectSSE } from './api/events'
import { resetPathModeCache } from './utils/directoryUtils'
import { isTauri, isTauriMobile } from './utils/tauri'
import { apiErrorHandler, globalErrorHandler } from './utils/errorHandling'

// Polyfill: randomUUID 在非 HTTPS 环境可能缺失（如局域网 HTTP）
// 统一补齐，避免业务层 scattered fallback。
function ensureRandomUUID() {
  const cryptoObj = globalThis.crypto as Crypto & { randomUUID?: () => string }
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') return
  if (typeof cryptoObj.randomUUID === 'function') return

  cryptoObj.randomUUID = () => {
    const bytes = new Uint8Array(16)
    cryptoObj.getRandomValues(bytes)
    // RFC 4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'))
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
  }
}

ensureRandomUUID()

// 禁用浏览器的 scroll restoration（刷新时不恢复旧 scrollTop），
// 由 ChatArea 自行控制定位
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

// 初始化主题系统（在 React 渲染前注入 CSS 变量，避免闪烁）
themeStore.init()

// 全局 overlay 滚动条 — 等 DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOverlayScrollbars)
} else {
  // DOM 已就绪（defer script 或者 module）
  requestAnimationFrame(initOverlayScrollbars)
}

// 注册 server 切换 → 清理所有 server-specific 状态 + SSE 重连
serverStore.onServerChange(() => {
  // 1. 清空内存中的 session/消息数据
  messageStore.clearAll()
  childSessionStore.clearAll()
  todoStore.clearAll()

  // 2. 重置路径模式缓存（不同服务器可能是不同操作系统）
  resetPathModeCache()

  // 4. 重新加载 auto-approve 开关状态（从新服务器 of storage key 读取）
  autoApproveStore.reloadFromStorage()

  // 5. 重连 SSE（会自动连到新服务器）
  reconnectSSE()
})

const isNativeTauri = isTauri()
const isNativeTauriMobile = isNativeTauri && isTauriMobile()

// Tauri 原生 app 初始化
if (isNativeTauri) {
  // 添加 CSS class 用于 safe-area 适配
  document.documentElement.classList.add('tauri-app')

  // 确保 viewport meta 包含 viewport-fit=cover（用于状态栏沉浸式）
  const viewportMeta = document.querySelector('meta[name="viewport"]')
  if (viewportMeta) {
    const content = viewportMeta.getAttribute('content') || ''
    if (!content.includes('viewport-fit=cover')) {
      viewportMeta.setAttribute('content', content + ', viewport-fit=cover')
    }
  }

  // Auto-start pi serve（如果设置开启）
  if (!isNativeTauriMobile && serviceStore.autoStart) {
    const serverUrl = serverStore.getActiveBaseUrl() || 'http://127.0.0.1:4096'
    const binaryPath = serviceStore.effectiveBinaryPath
    import('@tauri-apps/api/core').then(({ invoke }) => {
      serviceStore.setStarting(true)
      invoke<boolean>('start_pi_service', { url: serverUrl, binaryPath, envVars: serviceStore.envVarsRecord })
        .then(weStarted => {
          serviceStore.setStartedByUs(weStarted)
          serviceStore.setRunning(true)
          serviceStore.setStarting(false)
          if (weStarted) {
            console.info('[Service] pi serve started by app')
          } else {
            console.info('[Service] pi serve already running')
          }
        })
        .catch(err => {
          serviceStore.setStarting(false)
          apiErrorHandler('auto-start pi serve', err)
        })
    })
  }
}

// 全局错误处理 - 防止未捕获错误导致页面刷新
window.addEventListener('error', event => {
  globalErrorHandler('uncaught error', event.error)
  event.preventDefault()
})

window.addEventListener('unhandledrejection', event => {
  globalErrorHandler('unhandled promise rejection', event.reason)
  event.preventDefault()
})

async function bootstrap() {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const conn = await invoke<{ port: number; token: string } | null>('get_pi_agent_connection')
      if (conn) {
        console.log('[PiAgentUi] Discovered Pi Agent connection info:', conn)
        ;(globalThis as any).window.PI_BOOT_DATA = {
          baseUrl: `http://127.0.0.1:${conn.port}`,
          token: conn.token,
        }
      } else {
        console.log('[PiAgentUi] No active Pi Agent connection file found. App will run in standalone mode.')
      }
    } catch (err) {
      console.error('[PiAgentUi] Failed to get Pi Agent connection:', err)
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <DirectoryProvider>
            <SessionProvider>
              <App />
            </SessionProvider>
          </DirectoryProvider>
        </Suspense>
      </ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap()
