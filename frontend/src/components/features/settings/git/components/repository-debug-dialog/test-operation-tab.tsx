// Test Operation Tab - Reusable component for debug operations

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, FileText, Edit, X, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import type { DebugResult, DebugOperation } from '../../types'

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
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-1">Important:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>{warning}</li>
                  <li>Requires write access and valid credentials</li>
                  <li>Test file: <code className="bg-yellow-100 px-1 rounded">.cockpit_debug_test.txt</code></li>
                </ul>
              </div>
            </div>
          </div>
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
            <div className={`p-4 rounded-md ${
              result.success
                ? 'bg-green-50 border border-green-200'
                : operation === 'read'
                ? 'bg-yellow-50 border border-yellow-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className={`h-5 w-5 mt-0.5 ${
                    operation === 'read' ? 'text-yellow-600' : 'text-red-600'
                  }`} />
                )}
                <div>
                  <div className={`font-medium ${
                    result.success
                      ? 'text-green-800'
                      : operation === 'read'
                      ? 'text-yellow-800'
                      : 'text-red-800'
                  }`}>
                    {result.message}
                  </div>
                  {result.details?.suggestion != null && (
                    <div className="text-sm text-gray-600 mt-1">
                      {String(result.details.suggestion)}
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                          <span className="font-medium text-gray-700">{key}:</span>
                        </div>
                        {(key === 'content' || key === 'commit_message') && typeof value === 'string' ? (
                          <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{value}</pre>
                        ) : (
                          <span className="text-gray-900 break-all">{String(value)}</span>
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
