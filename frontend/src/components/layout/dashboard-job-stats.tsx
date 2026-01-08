'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import {
  XCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react'

interface JobRunStats {
  total: number
  completed: number
  failed: number
  running: number
}

interface BackupDeviceStats {
  total_devices: number
  successful_devices: number
  failed_devices: number
}

interface JobDashboardStats {
  job_runs: JobRunStats
  backup_devices: BackupDeviceStats
}

interface DashboardJobStatsProps {
  refreshTrigger?: number
}

export default function DashboardJobStats({ refreshTrigger = 0 }: DashboardJobStatsProps) {
  const { apiCall } = useApi()
  const [jobStats, setJobStats] = useState<JobDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadJobStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiCall<JobDashboardStats>('job-runs/dashboard/stats')
      setJobStats(data)
    } catch (err) {
      console.error('Error fetching job stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load job statistics')
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  useEffect(() => {
    loadJobStats()
  }, [loadJobStats, refreshTrigger])

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const jobRunCards = [
    {
      title: 'Failed Jobs',
      value: jobStats?.job_runs.failed || 0,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      iconBg: 'bg-red-100',
      description: 'Jobs with errors'
    }
  ]

  if (error) {
    return (
      <div className="col-span-full">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load job statistics: {error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      {/* Job Run Statistics Header */}
      <div className="col-span-full">
        <h2 className="text-xl font-semibold text-slate-900">Job Execution Statistics</h2>
        <p className="text-sm text-slate-600">Overview of job runs and backup operations</p>
      </div>

      {/* Job Run Cards */}
      {jobRunCards.map((card) => {
        const IconComponent = card.icon
        return (
          <Card key={card.title} className={cn(
            "analytics-card border-0 transition-all duration-300 hover:shadow-analytics-lg",
            loading && "animate-pulse"
          )}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-xl ${card.iconBg} ring-1 ring-white/20`}>
                  <IconComponent className={`h-6 w-6 ${card.color}`} />
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-3xl font-bold text-slate-900",
                    loading && "text-slate-400"
                  )}>
                    {loading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    ) : (
                      formatNumber(card.value)
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardTitle className="text-sm font-semibold text-slate-700 mb-2">
                {card.title}
              </CardTitle>
              <p className="text-xs text-slate-500 leading-relaxed">{card.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </>
  )
}
