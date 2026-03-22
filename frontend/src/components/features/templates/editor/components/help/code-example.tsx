'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

interface CodeExampleProps {
  title: string
  code: string
  language?: string
}

export function CodeExample({ title, code, language = 'jinja2' }: CodeExampleProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-100 px-4 py-2 border-b border-slate-200">
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {language}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2">
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <pre className="bg-slate-900 text-green-400 p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}
