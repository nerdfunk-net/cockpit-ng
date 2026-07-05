import { Fragment, useState } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusIcon } from '@/components/shared/status-icon'
import { StatusBadge } from '@/components/shared/status-badge'
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react'
import type { CommandResult, ExecutionSummary } from '../types'

interface ExecutionResultsProps {
  results: CommandResult[]
  summary: ExecutionSummary
}

export function ExecutionResults({ results, summary }: ExecutionResultsProps) {
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set())

  const toggleDeviceDetails = (deviceName: string) => {
    const newExpanded = new Set(expandedDevices)
    if (newExpanded.has(deviceName)) {
      newExpanded.delete(deviceName)
    } else {
      newExpanded.add(deviceName)
    }
    setExpandedDevices(newExpanded)
  }

  const getResultIcon = (success: boolean) => (
    <StatusIcon variant={success ? 'success' : 'error'} className="h-5 w-5" />
  )

  const getResultBadge = (success: boolean) => (
    <StatusBadge variant={success ? 'success' : 'error'}>
      {success ? 'Success' : 'Failed'}
    </StatusBadge>
  )

  return (
    <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
      <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Terminal className="h-4 w-4" />
          <span className="text-sm font-medium">Execution Results</span>
        </div>
        <div className="text-xs text-panel-header-muted">
          {summary.successful} successful, {summary.failed} failed of {summary.total}{' '}
          devices
        </div>
      </div>
      <div className="p-6 panel-content">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-2 border-info-border bg-info">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs text-info-foreground">
                Total Devices
              </CardDescription>
              <CardTitle className="text-2xl text-info-foreground">
                {summary.total}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2 border-success-border bg-success">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs text-success-foreground">
                Successful
              </CardDescription>
              <CardTitle className="text-2xl text-success-foreground">
                {summary.successful}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2 border-error-border bg-error">
            <CardHeader className="pb-3">
              <CardDescription className="text-xs text-error-foreground">
                Failed
              </CardDescription>
              <CardTitle className="text-2xl text-error-foreground">
                {summary.failed}
              </CardTitle>
            </CardHeader>
          </Card>
          {summary.cancelled > 0 && (
            <Card className="border-2 border-warning-border bg-warning">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs text-warning-foreground">
                  Cancelled
                </CardDescription>
                <CardTitle className="text-2xl text-warning-foreground">
                  {summary.cancelled}
                </CardTitle>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, index) => (
                <Fragment key={result.device || `result-${index}`}>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>{getResultIcon(result.success)}</TableCell>
                    <TableCell className="font-medium">{result.device}</TableCell>
                    <TableCell>{getResultBadge(result.success)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.success
                        ? 'Commands executed successfully'
                        : result.error || 'Execution failed'}
                    </TableCell>
                    <TableCell className="text-right">
                      {result.output && (
                        <Button
                          onClick={() => toggleDeviceDetails(result.device)}
                          size="sm"
                          variant="ghost"
                          className="flex items-center gap-1"
                        >
                          {expandedDevices.has(result.device) ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Hide Output
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Show Output
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedDevices.has(result.device) && result.output && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <div className="bg-gray-900 p-4 border-t border-gray-700">
                          <div className="mb-2 text-xs text-gray-400 font-medium">
                            Output for {result.device}:
                          </div>
                          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                            {result.output}
                          </pre>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
