'use client'

import { Check, Copy, FileJson } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AnsibleFactsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  facts: Record<string, unknown> | null | undefined
}

export function AnsibleFactsModal({
  open,
  onOpenChange,
  label,
  facts,
}: AnsibleFactsModalProps) {
  const [copied, setCopied] = useState(false)

  const json = facts ? JSON.stringify(facts, null, 2) : null

  const handleCopy = async () => {
    if (!json) return
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-blue-600" />
            Ansible Facts — {label}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-end mb-2">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!json}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy JSON
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-auto min-h-0 border border-gray-200 rounded-md bg-gray-50">
          {json ? (
            <pre className="p-4 text-xs font-mono text-gray-800 whitespace-pre leading-relaxed">
              {json}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              No Ansible facts available for this server.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
