import { useSyncExternalStore } from 'react'
import { CodeMirrorReadonly } from './CodeMirrorReadonly'
import { codeLineHeight } from './codeMirrorReadonlyExtensions'
import { useSyntaxHighlightRef } from '../hooks/useSyntaxHighlight'
import { themeStore } from '../store/themeStore'

interface CodePreviewProps {
  code: string
  language: string
  maxHeight?: number
  isResizing?: boolean
  wordWrap?: boolean
}

export function CodePreview({ code, language, maxHeight, isResizing = false, wordWrap }: CodePreviewProps) {
  const { codeWordWrap, codeFontScale } = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot)
  const resolvedWordWrap = wordWrap ?? codeWordWrap
  const { tokensRef, version } = useSyntaxHighlightRef(code, {
    lang: language,
    enabled: language !== 'text',
  })

  return (
    <CodeMirrorReadonly
      code={code}
      tokensRef={tokensRef}
      tokensVersion={version}
      wordWrap={resolvedWordWrap}
      lineHeight={codeLineHeight(codeFontScale)}
      maxHeight={maxHeight}
      isResizing={isResizing}
    />
  )
}
