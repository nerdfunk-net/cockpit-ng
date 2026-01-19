import { useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Download } from 'lucide-react'
import type { CheckResult } from '../types'
import { getStatusIcon, getStatusColor } from '../utils/check-ip-utils'
import { exportToCSV } from '../utils/csv-export'

interface CheckIPResultsProps {
  results: CheckResult[]
  showAll: boolean
  onToggleShowAll: () => void
}

export function CheckIPResults({ results, showAll, onToggleShowAll }: CheckIPResultsProps) {
  const filteredResults = useMemo(() =>
    showAll ? results : results.filter(r => r.status !== 'match'),
    [results, showAll]
  )

  const handleExport = useCallback(() => {
    exportToCSV(results)
  }, [results])

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>Results</span>
            </CardTitle>
            <CardDescription className="text-white/90 text-xs mt-1">
              {showAll
                ? `Showing all ${results.length} devices`
                : `Showing ${filteredResults.length} differences (${results.length} total)`
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onToggleShowAll}
              variant={showAll ? "secondary" : "outline"}
              size="sm"
              className="bg-white text-gray-900 hover:bg-gray-100 border-white"
            >
              {showAll ? 'Show Differences Only' : 'Show All'}
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="bg-white text-gray-900 hover:bg-gray-100 border-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Results
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
        <div className="space-y-2">
          {filteredResults.map((result) => (
            <div
              key={`${result.ip_address}-${result.device_name}`}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(result.status)}
                <div>
                  <p className="font-medium">{result.device_name}</p>
                  <p className="text-sm text-muted-foreground">{result.ip_address}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(result.status)} variant="outline">
                  {result.status.replace('_', ' ').toUpperCase()}
                </Badge>
                {result.nautobot_device_name && result.nautobot_device_name !== result.device_name && (
                  <span className="text-sm text-muted-foreground">
                    → {result.nautobot_device_name}
                  </span>
                )}
                {result.error && (
                  <span className="text-sm text-red-600">
                    {result.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
