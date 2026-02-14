'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, Plus, Bug } from 'lucide-react'
import { useJobSchedules, useJobTemplates, useCredentials } from '../hooks/use-schedule-queries'
import { ScheduleDebugDialog } from './schedule-debug-dialog'
import { ScheduleFormDialog } from './schedule-form-dialog'
import { SchedulesGrid } from './schedules-grid'
import { EMPTY_SCHEDULES, EMPTY_TEMPLATES, EMPTY_CREDENTIALS } from '../utils/constants'
import type { JobSchedule } from '../types'

export function JobsSchedulerPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDebugDialogOpen, setIsDebugDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<JobSchedule | null>(null)

  // TanStack Query hooks - replaces all manual state management
  const { data: schedules = EMPTY_SCHEDULES, isLoading } = useJobSchedules()
  const { data: templates = EMPTY_TEMPLATES } = useJobTemplates()
  const { data: credentials = EMPTY_CREDENTIALS } = useCredentials()

  const handleCreateClick = () => {
    setEditingJob(null)
    setIsDialogOpen(true)
  }

  const handleEditSchedule = (schedule: JobSchedule) => {
    setEditingJob(schedule)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingJob(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Job Scheduler</h1>
            <p className="text-muted-foreground mt-2">
              Schedule automated tasks using job templates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsDebugDialogOpen(true)}>
            <Bug className="mr-2 h-4 w-4" />
            Debug Scheduler
          </Button>
          <Button onClick={handleCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Schedules Grid */}
      <SchedulesGrid
        schedules={schedules}
        isLoading={isLoading}
        hasTemplates={templates.length > 0}
        onCreateClick={handleCreateClick}
        onEditSchedule={handleEditSchedule}
      />

      {/* Debug Dialog */}
      <ScheduleDebugDialog
        open={isDebugDialogOpen}
        onOpenChange={setIsDebugDialogOpen}
      />

      {/* Form Dialog */}
      <ScheduleFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        editingJob={editingJob}
        templates={templates}
        credentials={credentials}
        onSuccess={() => {
          // TanStack Query automatically refetches after mutation
        }}
      />
    </div>
  )
}
