'use client'
'use no memo'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Plus, Edit, Globe, User } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import type { JobSchedule, JobTemplate, Credential, ScheduleFormData } from '../types'
import { useScheduleMutations } from '../hooks/use-schedule-mutations'
import { getJobTypeLabel, formatTimeWithTimezone } from '../utils/schedule-utils'
import { DEFAULT_SCHEDULE } from '../utils/constants'

// Zod validation schema
const scheduleFormSchema = z.object({
  job_identifier: z.string().min(1, "Identifier is required").max(100),
  job_template_id: z.number().min(1, "Template is required"),
  schedule_type: z.enum(["now", "interval", "hourly", "daily", "weekly", "monthly", "custom"]),
  interval_minutes: z.number().min(1).max(1440).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format").optional(),
  is_active: z.boolean(),
  is_global: z.boolean(),
  credential_id: z.number().nullable().optional(),
})

type FormData = z.infer<typeof scheduleFormSchema>

interface ScheduleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingJob: JobSchedule | null
  templates: JobTemplate[]
  credentials: Credential[]
  onSuccess: () => void
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  editingJob,
  templates,
  credentials,
  onSuccess
}: ScheduleFormDialogProps) {
  const user = useAuthStore(state => state.user)
  const { createSchedule, updateSchedule } = useScheduleMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: editingJob ? {
      job_identifier: editingJob.job_identifier,
      job_template_id: editingJob.job_template_id,
      schedule_type: editingJob.schedule_type,
      interval_minutes: editingJob.interval_minutes || 60,
      start_time: editingJob.start_time || '00:00',
      is_active: editingJob.is_active,
      is_global: editingJob.is_global,
      credential_id: editingJob.credential_id ?? null,
    } : DEFAULT_SCHEDULE,
  })

  // Reset form when dialog opens with editing job
  useEffect(() => {
    if (open && editingJob) {
      form.reset({
        job_identifier: editingJob.job_identifier,
        job_template_id: editingJob.job_template_id,
        schedule_type: editingJob.schedule_type,
        interval_minutes: editingJob.interval_minutes || 60,
        start_time: editingJob.start_time || '00:00',
        is_active: editingJob.is_active,
        is_global: editingJob.is_global,
        credential_id: editingJob.credential_id ?? null,
      })
    } else if (open && !editingJob) {
      form.reset(DEFAULT_SCHEDULE)
    }
  }, [open, editingJob, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (editingJob) {
      await updateSchedule.mutateAsync({ id: editingJob.id, data })
    } else {
      await createSchedule.mutateAsync(data as ScheduleFormData)
    }
    onOpenChange(false)
    onSuccess()
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const scheduleType = form.watch('schedule_type')
  // eslint-disable-next-line react-hooks/incompatible-library
  const startTime = form.watch('start_time')
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedTemplateId = form.watch('job_template_id')
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  const requiresCredential = selectedTemplate &&
    (selectedTemplate.job_type === 'backup' || selectedTemplate.job_type === 'run_commands')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl sm:!max-w-5xl p-0 gap-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 px-6 py-4">
          <DialogHeader className="text-white">
            <DialogTitle className="text-lg font-semibold text-white">
              {editingJob ? "Edit Schedule" : "Create Schedule"}
            </DialogTitle>
            <DialogDescription className="text-blue-50">
              {editingJob ? "Update schedule settings" : "Schedule a job template to run automatically"}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Form content */}
        <Form {...form}>
          <form onSubmit={onSubmit} className="px-6 py-4 space-y-4">
            {/* Template and Identifier */}
            <div className="grid grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="job_template_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Template</FormLabel>
                    <Select
                      value={field.value > 0 ? field.value.toString() : ''}
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      disabled={!!editingJob}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            <div className="flex items-center gap-2">
                              {template.is_global ? (
                                <Globe className="h-3.5 w-3.5 text-blue-500" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-gray-400" />
                              )}
                              <span className="font-medium">{template.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({getJobTypeLabel(template.job_type)})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="job_identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Identifier</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., daily-backup-core" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Template description */}
            {selectedTemplate && (
              <div className="px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-600">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {getJobTypeLabel(selectedTemplate.job_type)}
                  </Badge>
                  {selectedTemplate.is_global ? (
                    <Badge className="text-xs bg-blue-100 text-blue-700">Global</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Private</Badge>
                  )}
                </div>
                {selectedTemplate.description || "No description provided"}
              </div>
            )}

            {/* Schedule Type and Timing */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="schedule_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="now">Run Once</SelectItem>
                        <SelectItem value="interval">Every X Minutes</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {scheduleType === 'interval' && (
                <FormField
                  control={form.control}
                  name="interval_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interval (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={1440}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {['hourly', 'daily', 'weekly', 'monthly'].includes(scheduleType) && (
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time (UTC)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Timezone notice */}
            {['hourly', 'daily', 'weekly', 'monthly'].includes(scheduleType) && startTime && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-sm">
                <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                <p className="text-blue-700">
                  <span className="font-medium">All times are in UTC.</span>
                  {' '}For {startTime} UTC, that&apos;s{' '}
                  <span className="font-mono font-medium">{formatTimeWithTimezone(startTime)}</span>
                  {' '}local time.
                </p>
              </div>
            )}

            {/* Credential selector */}
            {requiresCredential && (
              <FormField
                control={form.control}
                name="credential_id"
                render={({ field }) => (
                  <FormItem className="pt-3 border-t">
                    <FormLabel>
                      Device Credentials <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select
                      value={field.value?.toString() || 'none'}
                      onValueChange={(v) => field.onChange(v === 'none' ? null : parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select credentials" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-gray-400">No credential selected</span>
                        </SelectItem>
                        {credentials.map((cred) => (
                          <SelectItem key={cred.id} value={cred.id.toString()}>
                            <div className="flex items-center gap-2">
                              {cred.source === 'general' ? (
                                <Globe className="h-3.5 w-3.5 text-blue-500" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-gray-400" />
                              )}
                              <span className="font-medium">{cred.name}</span>
                              <span className="text-xs text-muted-foreground">({cred.username})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Options */}
            <div className="flex items-center gap-6 pt-3 border-t">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">Active</FormLabel>
                  </FormItem>
                )}
              />

              {user?.roles?.includes('admin') && !editingJob && (
                <FormField
                  control={form.control}
                  name="is_global"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 pl-6 border-l">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0 cursor-pointer flex items-center gap-2">
                        Global Schedule
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                          Admin
                        </Badge>
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSchedule.isPending || updateSchedule.isPending}
              >
                {editingJob ? (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Update Schedule
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Schedule
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
