// Connection Test Panel Component

import { Button } from '@/components/ui/button'
import { RefreshCw, TestTube, CheckCircle, AlertCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
    <div className="bg-blue-50 p-4 rounded-lg">
      <h4 className="text-sm font-medium text-blue-900 mb-2">Test Connection</h4>
      <p className="text-sm text-blue-700 mb-3">
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
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
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
          <div className={`flex items-center gap-2 text-sm ${
            status.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            {status.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {status.text}
          </div>
        )}
      </div>
    </div>
  )
}
