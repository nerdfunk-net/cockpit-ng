import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Info } from 'lucide-react'
import type { CheckResult } from '../types'
import { RESULT_STATUS } from '../types'

interface CheckIPSummaryProps {
  results: CheckResult[]
}

export function CheckIPSummary({ results }: CheckIPSummaryProps) {
  const stats = useMemo(
    () => ({
      total: results.length,
      matches: results.filter(r => r.status === RESULT_STATUS.MATCH).length,
      mismatches: results.filter(r => r.status === RESULT_STATUS.NAME_MISMATCH).length,
      partialMismatches: results.filter(r => r.status === RESULT_STATUS.NAME_PARTIAL_MISMATCH).length,
      notFound: results.filter(r => r.status === RESULT_STATUS.IP_NOT_FOUND).length,
    }),
    [results]
  )

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="panel-header border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Info className="h-4 w-4" />
          <span>Summary</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 panel-content">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Devices</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Matches</p>
            <p className="text-2xl font-bold text-success-foreground">{stats.matches}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Mismatches</p>
            <p className="text-2xl font-bold text-warning-foreground">{stats.mismatches}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Partial Mismatches</p>
            <p className="text-2xl font-bold text-warning-foreground">{stats.partialMismatches}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Not Found</p>
            <p className="text-2xl font-bold text-error-foreground">{stats.notFound}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
