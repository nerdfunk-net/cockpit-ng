'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, RefreshCw } from 'lucide-react'
import type { JobSchedule } from '../types'
import { ScheduleCard } from './schedule-card'

interface SchedulesGridProps {
  schedules: JobSchedule[]
  isLoading: boolean
  hasTemplates: boolean
  onCreateClick: () => void
  onEditSchedule: (schedule: JobSchedule) => void
}

export function SchedulesGrid({
  schedules,
  isLoading,
  hasTemplates,
  onCreateClick,
  onEditSchedule
}: SchedulesGridProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading schedules...</span>
        </CardContent>
      </Card>
    )
  }

  if (schedules.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-96">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl font-semibold mb-2">No schedules yet</p>
          <p className="text-muted-foreground mb-4">
            Create your first schedule using a job template
          </p>
          {!hasTemplates ? (
            <p className="text-sm text-amber-600">
              Create a job template first in Jobs → Job Templates
            </p>
          ) : (
            <Button onClick={onCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Create Schedule
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {schedules.map((schedule) => (
        <ScheduleCard
          key={schedule.id}
          schedule={schedule}
          onEdit={onEditSchedule}
        />
      ))}
    </div>
  )
}
