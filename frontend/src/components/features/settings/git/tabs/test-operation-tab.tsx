// Test Operation Tab - Reusable component for debug operations

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, FileText, Edit, X, Upload } from 'lucide-react'
import { StatusAlert } from '@/components/shared/status-alert'
import type { DebugResult, DebugOperation } from '../types'

interface TestOperationTabProps {
  title: string
  description: string
  operation: DebugOperation
  result: DebugResult | null
  isLoading: boolean
  onRun: () => void
  variant?: 'default' | 'destructive'
  warning?: string
}

export function TestOperationTab({
  title,
  description,
  operation,
  result,
  isLoading,
  onRun,
  variant = 'default',
  warning,
}: TestOperationTabProps) {
  const renderIcon = () => {
    if (isLoading) {
      return <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
    }

    switch (operation) {
      case 'read':
        return <FileText className="h-4 w-4 mr-2" />
      case 'write':
        return <Edit className="h-4 w-4 mr-2" />
      case 'delete':
        return <X className="h-4 w-4 mr-2" />
      case 'push':
        return <Upload className="h-4 w-4 mr-2" />
      default:
        return <FileText className="h-4 w-4 mr-2" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {warning && (
          <StatusAlert variant="warning" className="mb-4">
            <div className="font-medium mb-1">Important:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>{warning}</li>
              <li>Requires write access and valid credentials</li>
              <li>
                Test file:{' '}
                <code className="bg-warning-border/40 px-1 rounded">
                  .cockpit_debug_test.txt
                </code>
              </li>
            </ul>
          </StatusAlert>
        )}

        <Button
          onClick={onRun}
          disabled={isLoading}
          variant={variant}
          className="w-full"
        >
          {renderIcon()}
          Test {operation.charAt(0).toUpperCase() + operation.slice(1)} Operation
        </Button>

        {result && (
          <div className="space-y-4">
            <StatusAlert
              variant={
                result.success ? 'success' : operation === 'read' ? 'warning' : 'error'
              }
            >
              <div className="font-medium">{result.message}</div>
              {result.details?.suggestion != null && (
                <div className="text-sm mt-1">
                  {String(result.details.suggestion)}
                </div>
              )}
            </StatusAlert>

            {result.details && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {Object.entries(result.details).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">{key}:</span>
                        </div>
                        {(key === 'content' || key === 'commit_message') &&
                        typeof value === 'string' ? (
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            {value}
                          </pre>
                        ) : (
                          <span className="text-foreground break-all">
                            {String(value)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
