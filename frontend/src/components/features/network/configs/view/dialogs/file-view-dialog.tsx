'use client'

import { FileText, Download, Copy, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFileContentQuery } from '@/hooks/queries/use-file-content-query'
import { useState } from 'react'

interface FileViewDialogProps {
  isOpen: boolean
  onClose: () => void
  repoId: number | null
  filePath: string | null
  onDownload?: () => void
}

export function FileViewDialog({
  isOpen,
  onClose,
  repoId,
  filePath,
  onDownload,
}: FileViewDialogProps) {
  const [copied, setCopied] = useState(false)

  const { data, isLoading, error } = useFileContentQuery(repoId, filePath, {
    enabled: isOpen && !!repoId && !!filePath,
  })

  const handleCopyToClipboard = async () => {
    if (data) {
      try {
        await navigator.clipboard.writeText(data)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="!max-w-none flex flex-col p-0 overflow-auto"
        style={{ resize: 'both', width: '80vw', height: '85vh', minWidth: '600px', minHeight: '400px' }}
      >
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            File Content
          </DialogTitle>
          <DialogDescription>
            {filePath && (
              <span className="font-mono text-xs">{filePath}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading file...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-destructive">
              <p className="text-sm">Error loading file</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center justify-between px-6 pb-2 flex-shrink-0">
              <div className="text-sm text-muted-foreground">
                {data.split('\n').length} lines • {new Blob([data]).size} bytes
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToClipboard}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </>
                  )}
                </Button>
                {onDownload && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 px-6 pb-6">
              <pre className="text-sm font-mono bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{data}</code>
              </pre>
            </ScrollArea>
          </>
        )}

        <div className="flex justify-end gap-2 px-6 pb-6 border-t pt-4 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
