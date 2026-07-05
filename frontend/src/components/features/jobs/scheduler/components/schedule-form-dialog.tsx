'use client'
'use no memo'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Plus, Edit, Globe, User } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import {
  usePasswordCredentialsQuery,
  type PasswordCredential,
} from '@/hooks/queries/use-ssh-credentials-query'
import type { JobSchedule, JobTemplate, Credential, ScheduleFormData } from '../types'
import { useScheduleMutations } from '../hooks/use-schedule-mutations'
import { getJobTypeLabel, formatTimeWithTimezone } from '../utils/schedule-utils'
import { DEFAULT_SCHEDULE } from '../utils/constants'

const EMPTY_PASSWORD_CREDENTIALS: PasswordCredential[] = []

// Zod validation schema
const scheduleFormSchema = z.object({
  job_identifier: z.string().min(1, 'Identifier is required').max(100),
  job_template_id: z.number().min(1, 'Template is required'),
  schedule_type: z.enum([
    'now',
    'interval',
    'hourly',
    'daily',
    'weekly',
    'monthly',
    'custom',
  ]),
  interval_minutes: z.number().min(1).max(1440).optional(),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format')
    .optional(),
  is_active: z.boolean(),
  is_global: z.boolean(),
  credential_id: z.number().nullable().optional(),
  facts_auth_type: z.enum(['ssh_key', 'ssh_key_passphrase', 'credentials']).optional(),
  facts_ansible_user: z.string().optional(),
  open_ports_auth_type: z
    .enum(['ssh_key', 'ssh_key_passphrase', 'credentials'])
    .optional(),
  open_ports_ansible_user: z.string().optional(),
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
  onSuccess,
}: ScheduleFormDialogProps) {
  const user = useAuthStore(state => state.user)
  const { createSchedule, updateSchedule } = useScheduleMutations()

  const editingJobParams = (editingJob?.job_parameters ?? {}) as {
    facts_auth_type?: 'ssh_key' | 'ssh_key_passphrase' | 'credentials'
    facts_ansible_user?: string
    open_ports_auth_type?: 'ssh_key' | 'ssh_key_passphrase' | 'credentials'
    open_ports_ansible_user?: string
  }

  const form = useForm<FormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: editingJob
      ? {
          job_identifier: editingJob.job_identifier,
          job_template_id: editingJob.job_template_id,
          schedule_type: editingJob.schedule_type,
          interval_minutes: editingJob.interval_minutes || 60,
          start_time: editingJob.start_time || '00:00',
          is_active: editingJob.is_active,
          is_global: editingJob.is_global,
          credential_id: editingJob.credential_id ?? null,
          facts_auth_type: editingJobParams.facts_auth_type ?? 'ssh_key',
          facts_ansible_user: editingJobParams.facts_ansible_user ?? 'root',
          open_ports_auth_type: editingJobParams.open_ports_auth_type ?? 'ssh_key',
          open_ports_ansible_user:
            editingJobParams.open_ports_ansible_user ?? 'root',
        }
      : DEFAULT_SCHEDULE,
  })

  // Reset form when dialog opens with editing job
  useEffect(() => {
    if (open && editingJob) {
      const jobParams = (editingJob.job_parameters ?? {}) as {
        facts_auth_type?: 'ssh_key' | 'ssh_key_passphrase' | 'credentials'
        facts_ansible_user?: string
        open_ports_auth_type?: 'ssh_key' | 'ssh_key_passphrase' | 'credentials'
        open_ports_ansible_user?: string
      }
      form.reset({
        job_identifier: editingJob.job_identifier,
        job_template_id: editingJob.job_template_id,
        schedule_type: editingJob.schedule_type,
        interval_minutes: editingJob.interval_minutes || 60,
        start_time: editingJob.start_time || '00:00',
        is_active: editingJob.is_active,
        is_global: editingJob.is_global,
        credential_id: editingJob.credential_id ?? null,
        facts_auth_type: jobParams.facts_auth_type ?? 'ssh_key',
        facts_ansible_user: jobParams.facts_ansible_user ?? 'root',
        open_ports_auth_type: jobParams.open_ports_auth_type ?? 'ssh_key',
        open_ports_ansible_user: jobParams.open_ports_ansible_user ?? 'root',
      })
    } else if (open && !editingJob) {
      form.reset(DEFAULT_SCHEDULE)
    }
  }, [open, editingJob, form])

  // eslint-disable-next-line react-hooks/incompatible-library
  const scheduleType = form.watch('schedule_type')

  const startTime = form.watch('start_time')

  const selectedTemplateId = form.watch('job_template_id')
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const isGetServerFacts = selectedTemplate?.job_type === 'get_server_facts'
  const isGetOpenPorts = selectedTemplate?.job_type === 'get_open_ports'

  const factsAuthType = form.watch('facts_auth_type')
  const openPortsAuthType = form.watch('open_ports_auth_type')

  // Password credentials for the Get Server Facts / Get Open Ports auth-method
  // picker — same source and filtering used by the "Add Server" dialog.
  const { data: passwordCredentials = EMPTY_PASSWORD_CREDENTIALS, isLoading: loadingPasswordCredentials } =
    usePasswordCredentialsQuery({ enabled: open && (isGetServerFacts || isGetOpenPorts) })

  // Clear the selected credential when the auth method changes
  useEffect(() => {
    if (isGetServerFacts) {
      form.setValue('credential_id', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factsAuthType])

  useEffect(() => {
    if (isGetOpenPorts) {
      form.setValue('credential_id', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPortsAuthType])

  const onSubmit = form.handleSubmit(async formValues => {
    const {
      facts_auth_type,
      facts_ansible_user,
      open_ports_auth_type,
      open_ports_ansible_user,
      ...rest
    } = formValues

    const authType = isGetOpenPorts ? open_ports_auth_type : facts_auth_type

    const data: ScheduleFormData = {
      ...rest,
      credential_id:
        isGetServerFacts || isGetOpenPorts
          ? authType === 'ssh_key'
            ? null
            : (rest.credential_id ?? null)
          : rest.credential_id,
      job_parameters: isGetServerFacts
        ? {
            facts_auth_type: facts_auth_type ?? 'ssh_key',
            facts_ansible_user:
              facts_auth_type === 'ssh_key' ? facts_ansible_user || 'root' : undefined,
          }
        : isGetOpenPorts
          ? {
              open_ports_auth_type: open_ports_auth_type ?? 'ssh_key',
              open_ports_ansible_user:
                open_ports_auth_type === 'ssh_key'
                  ? open_ports_ansible_user || 'root'
                  : undefined,
            }
          : undefined,
    }

    if (editingJob) {
      await updateSchedule.mutateAsync({ id: editingJob.id, data })
    } else {
      await createSchedule.mutateAsync(data)
    }
    onOpenChange(false)
    onSuccess()
  })

  const requiresCredential =
    selectedTemplate &&
    (selectedTemplate.job_type === 'backup' ||
      selectedTemplate.job_type === 'run_commands' ||
      selectedTemplate.job_type === 'get_client_data')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl sm:!max-w-5xl p-0 gap-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="panel-header px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingJob ? 'Edit Schedule' : 'Create Schedule'}
            </DialogTitle>
            <DialogDescription className="text-panel-header-muted">
              {editingJob
                ? 'Update schedule settings'
                : 'Schedule a job template to run automatically'}
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
                      onValueChange={v => field.onChange(parseInt(v))}
                      disabled={!!editingJob}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates.map(template => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            <div className="flex items-center gap-2">
                              {template.is_global ? (
                                <Globe className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
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
              <div className="px-3 py-2 rounded-md bg-muted border border-border text-sm text-muted-foreground">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {getJobTypeLabel(selectedTemplate.job_type)}
                  </Badge>
                  {selectedTemplate.is_global ? (
                    <Badge className="text-xs bg-info text-info-foreground">Global</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Private
                    </Badge>
                  )}
                </div>
                {selectedTemplate.description || 'No description provided'}
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
                          onChange={e => field.onChange(parseInt(e.target.value) || 60)}
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
            {['hourly', 'daily', 'weekly', 'monthly'].includes(scheduleType) &&
              startTime && (
                <div className="status-info border flex items-center gap-2 px-3 py-2 rounded-md text-sm">
                  <Globe className="h-4 w-4 shrink-0" />
                  <p>
                    <span className="font-medium">All times are in UTC.</span> For{' '}
                    {startTime} UTC, that&apos;s{' '}
                    <span className="font-mono font-medium">
                      {formatTimeWithTimezone(startTime)}
                    </span>{' '}
                    local time.
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
                      Device Credentials <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      value={field.value?.toString() || 'none'}
                      onValueChange={v =>
                        field.onChange(v === 'none' ? null : parseInt(v))
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select credentials" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">No credential selected</span>
                        </SelectItem>
                        {credentials.map(cred => (
                          <SelectItem key={cred.id} value={cred.id.toString()}>
                            <div className="flex items-center gap-2">
                              {cred.source === 'general' ? (
                                <Globe className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className="font-medium">{cred.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({cred.username})
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
            )}

            {/* Get Server Facts: authentication method (mirrors the Add Server dialog) */}
            {isGetServerFacts && (
              <div className="space-y-3 pt-3 border-t">
                <FormField
                  control={form.control}
                  name="facts_auth_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Authentication method <span className="text-destructive">*</span>
                      </FormLabel>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="space-y-2"
                      >
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-3">
                          <RadioGroupItem
                            value="ssh_key"
                            id="schedule-auth-ssh-key"
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-1">
                            <FormLabel
                              htmlFor="schedule-auth-ssh-key"
                              className="cursor-pointer text-sm font-medium text-foreground"
                            >
                              SSH key (no passphrase)
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Use the agent&apos;s configured SSH key with no passphrase
                              protection.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-3">
                          <RadioGroupItem
                            value="ssh_key_passphrase"
                            id="schedule-auth-ssh-passphrase"
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-1">
                            <FormLabel
                              htmlFor="schedule-auth-ssh-passphrase"
                              className="cursor-pointer text-sm font-medium text-foreground"
                            >
                              SSH key with passphrase
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              SSH key protected by a passphrase stored in the
                              credentials vault.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-3">
                          <RadioGroupItem
                            value="credentials"
                            id="schedule-auth-credentials"
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-1">
                            <FormLabel
                              htmlFor="schedule-auth-credentials"
                              className="cursor-pointer text-sm font-medium text-foreground"
                            >
                              Username &amp; password
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Authenticate using a stored username and password
                              credential.
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {factsAuthType === 'ssh_key' ? (
                  <FormField
                    control={form.control}
                    name="facts_ansible_user"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSH username</FormLabel>
                        <FormControl>
                          <Input placeholder="root" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="credential_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {factsAuthType === 'ssh_key_passphrase'
                            ? 'Passphrase credential'
                            : 'Login credential'}{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          value={field.value?.toString() || ''}
                          onValueChange={v => field.onChange(v ? parseInt(v) : null)}
                          disabled={loadingPasswordCredentials}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  loadingPasswordCredentials
                                    ? 'Loading…'
                                    : passwordCredentials.length === 0
                                      ? 'No credentials found'
                                      : 'Select credential'
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {passwordCredentials.map(cred => (
                              <SelectItem key={cred.id} value={cred.id.toString()}>
                                <span className="font-medium">{cred.name}</span>
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({cred.username})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {factsAuthType === 'ssh_key_passphrase'
                            ? 'The password field of this credential is used as the SSH key passphrase.'
                            : 'Stored credentials from Settings → Credentials.'}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {/* Get Open Ports: authentication method (mirrors the facts auth block) */}
            {isGetOpenPorts && (
              <div className="space-y-3 pt-3 border-t">
                <FormField
                  control={form.control}
                  name="open_ports_auth_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Authentication method <span className="text-destructive">*</span>
                      </FormLabel>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="space-y-2"
                      >
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-3">
                          <RadioGroupItem
                            value="ssh_key"
                            id="schedule-ports-auth-ssh-key"
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-1">
                            <FormLabel
                              htmlFor="schedule-ports-auth-ssh-key"
                              className="cursor-pointer text-sm font-medium text-foreground"
                            >
                              SSH key (no passphrase)
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Use the agent&apos;s configured SSH key with no passphrase
                              protection.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-3">
                          <RadioGroupItem
                            value="ssh_key_passphrase"
                            id="schedule-ports-auth-ssh-passphrase"
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-1">
                            <FormLabel
                              htmlFor="schedule-ports-auth-ssh-passphrase"
                              className="cursor-pointer text-sm font-medium text-foreground"
                            >
                              SSH key with passphrase
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              SSH key protected by a passphrase stored in the
                              credentials vault.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-3">
                          <RadioGroupItem
                            value="credentials"
                            id="schedule-ports-auth-credentials"
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-1">
                            <FormLabel
                              htmlFor="schedule-ports-auth-credentials"
                              className="cursor-pointer text-sm font-medium text-foreground"
                            >
                              Username &amp; password
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Authenticate using a stored username and password
                              credential.
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {openPortsAuthType === 'ssh_key' ? (
                  <FormField
                    control={form.control}
                    name="open_ports_ansible_user"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSH username</FormLabel>
                        <FormControl>
                          <Input placeholder="root" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="credential_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {openPortsAuthType === 'ssh_key_passphrase'
                            ? 'Passphrase credential'
                            : 'Login credential'}{' '}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          value={field.value?.toString() || ''}
                          onValueChange={v => field.onChange(v ? parseInt(v) : null)}
                          disabled={loadingPasswordCredentials}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  loadingPasswordCredentials
                                    ? 'Loading…'
                                    : passwordCredentials.length === 0
                                      ? 'No credentials found'
                                      : 'Select credential'
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {passwordCredentials.map(cred => (
                              <SelectItem key={cred.id} value={cred.id.toString()}>
                                <span className="font-medium">{cred.name}</span>
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({cred.username})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {openPortsAuthType === 'ssh_key_passphrase'
                            ? 'The password field of this credential is used as the SSH key passphrase.'
                            : 'Stored credentials from Settings → Credentials.'}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
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
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 cursor-pointer flex items-center gap-2">
                        Global Schedule
                        <Badge
                          variant="secondary"
                          className="text-xs bg-info text-info-foreground"
                        >
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
