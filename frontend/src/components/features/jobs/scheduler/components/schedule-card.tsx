'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, Play, Pause, Edit, Trash2, RefreshCw } from 'lucide-react'
import type { JobSchedule } from '../types'
import { useScheduleMutations } from '../hooks/use-schedule-mutations'
import { getScheduleTypeLabel, getScheduleTypeColor, getJobTypeLabel } from '../utils/schedule-utils'

interface ScheduleCardProps {
  schedule: JobSchedule
  onEdit: (schedule: JobSchedule) => void
}

export function ScheduleCard({ schedule, onEdit }: ScheduleCardProps) {
  const { toggleActive, deleteSchedule, runNow } = useScheduleMutations()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="flex items-center gap-2">
              {schedule.job_identifier}
              {schedule.is_global && (
                <Badge variant="secondary" className="text-xs">Global</Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              {schedule.template_name && (
                <>
                  <span className="font-medium">{schedule.template_name}</span>
                  <span className="text-xs">•</span>
                </>
              )}
              {schedule.template_job_type && (
                <Badge variant="outline" className="text-xs">
                  {getJobTypeLabel(schedule.template_job_type)}
                </Badge>
              )}
            </CardDescription>
          </div>
          {schedule.is_active ? (
            <Badge className="bg-green-500">Active</Badge>
          ) : (
            <Badge variant="secondary">Paused</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${getScheduleTypeColor(schedule.schedule_type)}`} />
          <span className="text-sm font-medium">
            {getScheduleTypeLabel(schedule.schedule_type, schedule)}
          </span>
        </div>

        {schedule.last_run && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last run: {new Date(schedule.last_run).toLocaleString()}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => runNow.mutate({ id: schedule.id, identifier: schedule.job_identifier })}
            disabled={runNow.isPending}
            className="flex-1"
          >
            {runNow.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Now
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(schedule)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleActive.mutate(schedule)}
            disabled={toggleActive.isPending}
          >
            {schedule.is_active ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => deleteSchedule.mutate(schedule.id)}
            disabled={deleteSchedule.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
