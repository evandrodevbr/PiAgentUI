/**
 * ModalShell - 全屏层基础设施
 *
 * 职责极简：
 * - Portal 渲染到 body
 * - ESC 关闭
 * - useDelayedRender 控制 mount/unmount
 * - 淡入/淡出动画（仅 opacity）
 *
 * 不管背景色、不管遮罩 — 这些由 children 自行决定。
 * 容器 fixed inset-0 铺满视口。
 */

import { memo, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModalAnimation } from '../../hooks/useModalAnimation'

interface ModalShellProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  /** z-index，默认 100 */
  zIndex?: number
  /** 外层容器样式，允许调用方限制覆盖范围 */
  style?: CSSProperties
}

export const ModalShell = memo(function ModalShell({ isOpen, onClose, children, zIndex = 100, style }: ModalShellProps) {
  const { isVisible, shouldRender } = useModalAnimation(isOpen, onClose)

  if (!shouldRender) return null

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col transition-opacity duration-200 ease-out"
      style={{
        zIndex,
        opacity: isVisible ? 1 : 0,
        ...style,
      }}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>,
    document.body,
  )
})
