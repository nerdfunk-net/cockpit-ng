import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Info } from 'lucide-react'
import type { CheckResult } from '../types'
import { RESULT_STATUS } from '../types'

interface CheckIPSummaryProps {
  results: CheckResult[]
}

export function CheckIPSummary({ results }: CheckIPSummaryProps) {
  const stats = useMemo(() => ({
    total: results.length,
    matches: results.filter(r => r.status === RESULT_STATUS.MATCH).length,
    mismatches: results.filter(r => r.status === RESULT_STATUS.NAME_MISMATCH).length,
    notFound: results.filter(r => r.status === RESULT_STATUS.IP_NOT_FOUND).length
  }), [results])

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Info className="h-4 w-4" />
          <span>Summary</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Devices</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Matches</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.matches}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Mismatches</p>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.mismatches}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Not Found</p>
            <p className="text-2xl font-bold text-red-600">
              {stats.notFound}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
