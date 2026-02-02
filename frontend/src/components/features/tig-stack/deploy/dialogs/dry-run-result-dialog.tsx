import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, XCircle } from 'lucide-react'
import type { DryRunResult } from '../types'

interface DryRunResultDialogProps {
  show: boolean
  onClose: () => void
  results: DryRunResult[]
}

export function DryRunResultDialog({
  show,
  onClose,
  results
}: DryRunResultDialogProps) {
  if (!results || results.length === 0) {
    return null
  }

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Dry Run Results - Rendered Configs</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={results[0]?.deviceId || ''} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="w-full">
              {results.map((result) => (
                <TabsTrigger key={result.deviceId} value={result.deviceId}>
                  {result.success ? (
                    <CheckCircle className="mr-1 h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="mr-1 h-3 w-3 text-red-500" />
                  )}
                  {result.deviceName}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          {results.map((result) => (
            <TabsContent key={result.deviceId} value={result.deviceId}>
              <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
                {result.success ? (
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {result.renderedConfig}
                  </pre>
                ) : (
                  <div className="text-destructive">
                    <p className="font-semibold">Rendering Failed</p>
                    <p className="mt-2">{result.error}</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
