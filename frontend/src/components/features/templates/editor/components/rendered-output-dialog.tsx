'use client'

import { useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, X, AlertTriangle, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { RenderResult } from '../types'
import { CodeEditorPanel } from './code-editor-panel'

interface RenderedOutputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: RenderResult | null
}

export function RenderedOutputDialog({
  open,
  onOpenChange,
  result,
}: RenderedOutputDialogProps) {
  const { toast } = useToast()

  const handleCopy = useCallback(async () => {
    if (result?.renderedContent) {
      await navigator.clipboard.writeText(result.renderedContent)
      toast({ title: 'Copied', description: 'Rendered output copied to clipboard' })
    }
  }, [result?.renderedContent, toast])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-6 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2 text-white">
            {result?.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Rendered Template
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 py-4 space-y-3">
          {result?.error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {result.error}
              </AlertDescription>
            </Alert>
          )}

          {result?.warnings && result.warnings.length > 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                {result.warnings.join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {result?.renderedContent && (
            <div className="h-[50vh]">
              <CodeEditorPanel
                value={result.renderedContent}
                onChange={() => {}}
                language="text"
                readOnly
              />
            </div>
          )}

          {!result?.renderedContent && !result?.error && (
            <p className="text-sm text-gray-500 text-center py-8">
              No rendered output available.
            </p>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
          {result?.renderedContent && (
            <Button onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-1" />
              Copy to Clipboard
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
