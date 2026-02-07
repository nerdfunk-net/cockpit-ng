'use client'

import { useCallback } from 'react'
import Editor, { loader } from '@monaco-editor/react'

// Self-host Monaco from public directory — no CDN dependency
// Required for air-gapped environments where jsdelivr.net is not available
loader.config({
  paths: {
    vs: '/monaco-editor/min/vs',
  },
})

interface CodeEditorPanelProps {
  value: string
  onChange: (value: string) => void
  language?: string
  readOnly?: boolean
}

function getMonacoLanguage(templateType: string): string {
  switch (templateType) {
    case 'jinja2':
      return 'html'
    case 'textfsm':
      return 'plaintext'
    case 'text':
      return 'plaintext'
    default:
      return 'html'
  }
}

export function CodeEditorPanel({
  value,
  onChange,
  language = 'jinja2',
  readOnly = false,
}: CodeEditorPanelProps) {
  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val || '')
    },
    [onChange]
  )

  return (
    <div className="h-full w-full border rounded-lg overflow-hidden">
      <Editor
        height="100%"
        language={getMonacoLanguage(language)}
        value={value}
        onChange={handleChange}
        theme="vs"
        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          lineNumbers: 'on',
          fontSize: 14,
          scrollBeyondLastLine: false,
          readOnly,
          padding: { top: 8 },
          renderWhitespace: 'selection',
          tabSize: 2,
          automaticLayout: true,
        }}
      />
    </div>
  )
}
