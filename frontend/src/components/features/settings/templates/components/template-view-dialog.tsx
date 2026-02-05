'use client'

import { useEffect } from 'react'
import { escapeHtml } from '@/lib/security'
import { useTemplateContent } from '../hooks/use-template-queries'

interface TemplateViewDialogProps {
  templateId: number | null
  onClose: () => void
}

export function TemplateViewDialog({ templateId, onClose }: TemplateViewDialogProps) {
  const { data: content, isLoading } = useTemplateContent(
    templateId,
    { enabled: templateId !== null }
  )

  useEffect(() => {
    if (templateId !== null && !isLoading && content !== undefined) {
      // Open in new window for preview
      const previewWindow = window.open('', '_blank', 'width=800,height=600')
      if (previewWindow) {
        // Escape HTML content to prevent XSS attacks
        const safeContent = escapeHtml(content)

        previewWindow.document.write(`
          <html>
            <head>
              <title>Template Preview</title>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: monospace; margin: 20px; background: #f5f5f5; }
                pre { background: white; padding: 20px; border-radius: 8px; overflow: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: pre-wrap; word-wrap: break-word; }
                h2 { color: #333; margin-bottom: 20px; }
              </style>
            </head>
            <body>
              <h2>Template Preview (Read-Only)</h2>
              <pre>${safeContent}</pre>
            </body>
          </html>
        `)
        previewWindow.document.close()
      }

      // Close the dialog after opening the window
      onClose()
    }
  }, [templateId, isLoading, content, onClose])

  // This component doesn't render anything visible - it just opens a window
  return null
}
