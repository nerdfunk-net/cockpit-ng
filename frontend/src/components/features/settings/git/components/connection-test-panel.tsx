// Connection Test Panel Component

import { Button } from '@/components/ui/button'
import { RefreshCw, TestTube } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusIcon } from '@/components/shared/status-icon'

interface ConnectionTestPanelProps {
  onTest?: () => void
  status?: { type: 'success' | 'error'; text: string } | null
  isLoading?: boolean
  disabled?: boolean
}

export function ConnectionTestPanel({
  onTest,
  status,
  isLoading = false,
  disabled = false,
}: ConnectionTestPanelProps) {
  return (
    <div className="bg-info border border-info-border text-info-foreground p-4 rounded-lg">
      <h4 className="text-sm font-medium mb-2">Test Connection</h4>
      <p className="text-sm mb-3">
        Verify that the repository can be accessed with the provided settings.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={onTest}
                variant="outline"
                disabled={isLoading || disabled}
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Verify repository access with current settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {status && (
          <div className="flex items-center gap-2 text-sm">
            <StatusIcon variant={status.type === 'success' ? 'success' : 'error'} className="h-4 w-4" />
            {status.text}
          </div>
        )}
      </div>
    </div>
  )
}
