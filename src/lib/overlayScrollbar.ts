/**
 * overlayScrollbar — 全局自绘滚动条（垂直 + 水平）
 *
 * 隐藏浏览器原生滚动条，自动为所有可滚动容器注入 overlay thumb。
 *
 * 架构：
 *   CSS  * { scrollbar-width:none }              隐藏原生
 *   JS   MutationObserver 扫描 DOM → attach(el)  发现可滚动容器
 *        attach() → 在容器的父元素上创建 thumb     不随内容滚走
 *        scroll → getBoundingClientRect 定位       跟随容器视口
 *
 * 一个容器可以同时有垂直和水平两个 thumb。
 * scan 周期性检测方向变化，动态增删 thumb。
 *
 * thumb 挂在容器的父元素上：
 *   - 不被容器滚动带走
 *   - 不干扰 column-reverse 等 flex 布局
 *   - 受祖先 overflow 裁剪 → 容器消失 thumb 自然消失
 *
 * thumb 自身监听 pointerenter/pointerleave，
 * 防止鼠标从容器移向 thumb 时因 pointerleave 导致 thumb 消失。
 */

const ATTR = 'data-os'
const TRACK_PAD = 8
const MIN_THUMB = 32
const FADE_MS = 800

// ── 方向判断 ────────────────────────────────────────────

/** 带 no-scrollbar / scrollbar-none 的元素故意不要滚动条，跳过 */
function wantsNoScrollbar(el: HTMLElement): boolean {
  return el.classList.contains('no-scrollbar') || el.classList.contains('scrollbar-none')
}

function isScrollableY(el: HTMLElement): boolean {
  if (el === document.documentElement || el === document.body) return false
  if (el.tagName === 'INPUT') return false
  if (wantsNoScrollbar(el)) return false
  if (el.tagName === 'TEXTAREA') return el.scrollHeight > el.clientHeight + 1

  const oy = getComputedStyle(el).overflowY
  if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false
  return el.scrollHeight > el.clientHeight + 1
}

function isScrollableX(el: HTMLElement): boolean {
  if (el === document.documentElement || el === document.body) return false
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return false
  if (wantsNoScrollbar(el)) return false

  const ox = getComputedStyle(el).overflowX
  if (ox !== 'auto' && ox !== 'scroll' && ox !== 'overlay') return false
  return el.scrollWidth > el.clientWidth + 1
}

function isScrollable(el: HTMLElement): boolean {
  return isScrollableY(el) || isScrollableX(el)
}

// ── 单轴 thumb 管理 ────────────────────────────────────

interface AxisThumb {
  thumb: HTMLDivElement
  dragging: boolean
  fadeTimer: ReturnType<typeof setTimeout> | null
  onThumbDown: (e: PointerEvent) => void
  onThumbEnter: () => void
  onThumbLeave: () => void
  update: () => void
  reveal: () => void
  scheduleFade: () => void
  destroy: () => void
}

function createAxisThumb(axis: 'v' | 'h', vp: HTMLElement, parent: HTMLElement): AxisThumb {
  const thumb = document.createElement('div')
  thumb.className = axis === 'v' ? 'os-thumb' : 'os-thumb os-thumb-x'
  parent.appendChild(thumb)

  let dragging = false
  let fadeTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleFade = () => {
    if (fadeTimer) clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => {
      if (!dragging) thumb.classList.remove('os-visible')
    }, FADE_MS)
  }

  const reveal = () => {
    const overflow = axis === 'v' ? vp.scrollHeight > vp.clientHeight + 1 : vp.scrollWidth > vp.clientWidth + 1
    if (overflow) {
      thumb.classList.add('os-visible')
      scheduleFade()
    }
  }

  const update = () => {
    const vpRect = vp.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()

    if (axis === 'v') {
      const { scrollTop, scrollHeight, clientHeight } = vp
      if (scrollHeight <= clientHeight + 1) {
        thumb.classList.remove('os-visible')
        return
      }

      const track = vpRect.height - TRACK_PAD * 2
      let h = (clientHeight / scrollHeight) * track
      h = Math.max(h, MIN_THUMB)

      const maxScroll = scrollHeight - clientHeight
      const maxTop = track - h
      const isReverse = scrollTop < 0 || getComputedStyle(vp).flexDirection === 'column-reverse'
      const ratio = isReverse ? (maxScroll + scrollTop) / maxScroll : scrollTop / maxScroll
      const thumbY = TRACK_PAD + (maxScroll > 0 ? ratio * maxTop : 0)

      thumb.style.height = `${h}px`
      thumb.style.top = `${vpRect.top - parentRect.top + thumbY}px`
      thumb.style.right = `${parentRect.right - vpRect.right}px`
    } else {
      const { scrollLeft, scrollWidth, clientWidth } = vp
      if (scrollWidth <= clientWidth + 1) {
        thumb.classList.remove('os-visible')
        return
      }

      const track = vpRect.width - TRACK_PAD * 2
      let w = (clientWidth / scrollWidth) * track
      w = Math.max(w, MIN_THUMB)

      const maxScroll = scrollWidth - clientWidth
      const maxLeft = track - w
      const isRTL = getComputedStyle(vp).direction === 'rtl'
      const ratio = isRTL ? (maxScroll + scrollLeft) / maxScroll : scrollLeft / maxScroll
      const thumbX = TRACK_PAD + (maxScroll > 0 ? ratio * maxLeft : 0)

      thumb.style.width = `${w}px`
      thumb.style.left = `${vpRect.left - parentRect.left + thumbX}px`
      thumb.style.bottom = `${parentRect.bottom - vpRect.bottom}px`
    }
  }

  // 拖拽
  const onThumbDown = (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragging = true
    thumb.classList.add('os-dragging')
    thumb.setPointerCapture(e.pointerId)

    const startPos = axis === 'v' ? e.clientY : e.clientX
    const startScroll = axis === 'v' ? vp.scrollTop : vp.scrollLeft

    const onMove = (ev: PointerEvent) => {
      if (axis === 'v') {
        const maxScroll = vp.scrollHeight - vp.clientHeight
        const maxThumb = vp.clientHeight - thumb.offsetHeight
        if (maxThumb > 0) vp.scrollTop = startScroll + (ev.clientY - startPos) * (maxScroll / maxThumb)
      } else {
        const maxScroll = vp.scrollWidth - vp.clientWidth
        const maxThumb = vp.clientWidth - thumb.offsetWidth
        if (maxThumb > 0) vp.scrollLeft = startScroll + (ev.clientX - startPos) * (maxScroll / maxThumb)
      }
    }

    const onUp = (ev: PointerEvent) => {
      dragging = false
      thumb.classList.remove('os-dragging')
      thumb.releasePointerCapture(ev.pointerId)
      thumb.removeEventListener('pointermove', onMove)
      thumb.removeEventListener('pointerup', onUp)
      scheduleFade()
    }

    thumb.addEventListener('pointermove', onMove)
    thumb.addEventListener('pointerup', onUp)
  }

  // thumb 自身 hover：防止从容器移向 thumb 时消失
  const onThumbEnter = () => {
    if (fadeTimer) clearTimeout(fadeTimer)
  }
  const onThumbLeave = () => {
    if (!dragging) scheduleFade()
  }

  thumb.addEventListener('pointerdown', onThumbDown)
  thumb.addEventListener('pointerenter', onThumbEnter)
  thumb.addEventListener('pointerleave', onThumbLeave)

  const destroy = () => {
    thumb.removeEventListener('pointerdown', onThumbDown)
    thumb.removeEventListener('pointerenter', onThumbEnter)
    thumb.removeEventListener('pointerleave', onThumbLeave)
    if (fadeTimer) clearTimeout(fadeTimer)
    thumb.remove()
  }

  return { thumb, dragging, fadeTimer, onThumbDown, onThumbEnter, onThumbLeave, update, reveal, scheduleFade, destroy }
}

// ── Entry ───────────────────────────────────────────────

interface Entry {
  vp: HTMLElement
  parent: HTMLElement
  v: AxisThumb | null
  h: AxisThumb | null
  ro: ResizeObserver
  onScroll: () => void
  onEnter: () => void
  onLeave: () => void
}
const entries = new Map<HTMLElement, Entry>()

function ensurePositioned(parent: HTMLElement) {
  const pos = getComputedStyle(parent).position
  if (pos === 'static' || pos === '') parent.style.position = 'relative'
}

function attach(vp: HTMLElement) {
  if (entries.has(vp)) return
  const parent = vp.parentElement
  if (!parent) return

  ensurePositioned(parent)

  const needsY = isScrollableY(vp)
  const needsX = isScrollableX(vp)
  const v = needsY ? createAxisThumb('v', vp, parent) : null
  const h = needsX ? createAxisThumb('h', vp, parent) : null

  vp.setAttribute(ATTR, '')

  const update = () => {
    v?.update()
    h?.update()
  }

  const onScroll = () => {
    update()
    v?.reveal()
    h?.reveal()
  }

  /** 显示自身 + 内部后代 entry 的所有 thumb */
  const revealEntry = (e: Entry) => {
    if (e.v && e.vp.scrollHeight > e.vp.clientHeight + 1) {
      e.v.update()
      e.v.thumb.classList.add('os-visible')
      if (e.v.fadeTimer) clearTimeout(e.v.fadeTimer)
    }
    if (e.h && e.vp.scrollWidth > e.vp.clientWidth + 1) {
      e.h.update()
      e.h.thumb.classList.add('os-visible')
      if (e.h.fadeTimer) clearTimeout(e.h.fadeTimer)
    }
  }

  const fadeEntry = (e: Entry) => {
    if (e.v && !e.v.dragging) {
      if (e.v.fadeTimer) clearTimeout(e.v.fadeTimer)
      e.v.fadeTimer = setTimeout(() => e.v!.thumb.classList.remove('os-visible'), 400)
    }
    if (e.h && !e.h.dragging) {
      if (e.h.fadeTimer) clearTimeout(e.h.fadeTimer)
      e.h.fadeTimer = setTimeout(() => e.h!.thumb.classList.remove('os-visible'), 400)
    }
  }

  const onEnter = () => {
    // 显示自身 + 内部后代 entry 的所有 thumb
    for (const e of entries.values()) {
      if (e.vp === vp || vp.contains(e.vp)) revealEntry(e)
    }
  }

  const onLeave = () => {
    for (const e of entries.values()) {
      if (e.vp === vp || vp.contains(e.vp)) fadeEntry(e)
    }
  }

  vp.addEventListener('scroll', onScroll, { passive: true })
  vp.addEventListener('pointerenter', onEnter)
  vp.addEventListener('pointerleave', onLeave)

  const ro = new ResizeObserver(() => update())
  ro.observe(vp)
  update()

  const entry: Entry = { vp, parent, v, h, ro, onScroll, onEnter, onLeave }
  entries.set(vp, entry)
}

// ── 卸载 ────────────────────────────────────────────────

function detach(vp: HTMLElement) {
  const e = entries.get(vp)
  if (!e) return

  vp.removeEventListener('scroll', e.onScroll)
  vp.removeEventListener('pointerenter', e.onEnter)
  vp.removeEventListener('pointerleave', e.onLeave)
  e.v?.destroy()
  e.h?.destroy()
  e.ro.disconnect()
  vp.removeAttribute(ATTR)
  entries.delete(vp)
}

// ── 方向变化检测 ────────────────────────────────────────

function reconcile(vp: HTMLElement, entry: Entry) {
  const needsY = isScrollableY(vp)
  const needsX = isScrollableX(vp)
  const hasY = !!entry.v
  const hasX = !!entry.h

  if (needsY && !hasY) {
    ensurePositioned(entry.parent)
    entry.v = createAxisThumb('v', vp, entry.parent)
  } else if (!needsY && hasY) {
    entry.v!.destroy()
    entry.v = null
  }

  if (needsX && !hasX) {
    ensurePositioned(entry.parent)
    entry.h = createAxisThumb('h', vp, entry.parent)
  } else if (!needsX && hasX) {
    entry.h!.destroy()
    entry.h = null
  }
}

// ── 扫描 DOM ────────────────────────────────────────────

function scan() {
  // 已有 entry：检查是否还在 DOM / 方向是否变化
  for (const [vp, entry] of entries) {
    if (!document.contains(vp) || !isScrollable(vp)) {
      detach(vp)
    } else {
      reconcile(vp, entry)
    }
  }

  // 新元素
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
  let node: Node | null = walker.currentNode
  while (node) {
    const el = node as HTMLElement
    if (
      el.nodeType === 1 &&
      !entries.has(el) &&
      !el.hasAttribute(ATTR) &&
      !el.classList.contains('os-thumb') &&
      isScrollable(el)
    ) {
      attach(el)
    }
    node = walker.nextNode()
  }
}

// ── 初始化 ──────────────────────────────────────────────

let inited = false

export function initOverlayScrollbars() {
  if (inited) return
  inited = true

  scan()

  let timer: ReturnType<typeof setTimeout> | null = null
  const debounceScan = () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      scan()
    }, 200)
  }

  new MutationObserver(debounceScan).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  })

  window.addEventListener('resize', debounceScan, { passive: true })

  document.addEventListener(
    'scroll',
    () => {
      for (const e of entries.values()) {
        e.v?.update()
        e.h?.update()
      }
    },
    { capture: true, passive: true },
  )
}
