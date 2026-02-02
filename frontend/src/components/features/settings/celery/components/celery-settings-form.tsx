'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { Server, Trash2, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import { useCelerySettings } from '../hooks/use-celery-queries'
import { useCeleryMutations } from '../hooks/use-celery-mutations'
import type { CelerySettings } from '../types'
import { DEFAULT_CELERY_SETTINGS } from '../utils/constants'
import { QueueConfigList } from './queue-config-list'

const celerySettingsSchema = z.object({
  max_workers: z.number().min(1).max(32),
  cleanup_enabled: z.boolean(),
  cleanup_interval_hours: z.number().min(1).max(168),
  cleanup_age_hours: z.number().min(1).max(720),
  result_expires_hours: z.number().min(1).max(720),
  queues: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string(),
    })
  ),
})

type CelerySettingsFormData = z.infer<typeof celerySettingsSchema>

export function CelerySettingsForm() {
  const { data: settings, isLoading } = useCelerySettings()
  const { saveSettings, triggerCleanup } = useCeleryMutations()

  const form = useForm<CelerySettingsFormData>({
    resolver: zodResolver(celerySettingsSchema),
    values: settings ?? DEFAULT_CELERY_SETTINGS,
  })

  // Watch cleanup_enabled field
  const cleanupEnabled = useWatch({
    control: form.control,
    name: 'cleanup_enabled',
  })

  const handleSubmit = form.handleSubmit((data) => {
    saveSettings.mutate(data as CelerySettings)
  })

  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Worker Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-500" />
              <div>
                <CardTitle>Worker Configuration</CardTitle>
                <CardDescription>Configure Celery worker settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="max_workers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Workers (Concurrency)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={32}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 4)}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of concurrent worker processes. Default: 4
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <span className="font-medium">Restart Required:</span> Changes to worker configuration require restarting the Celery worker to take effect.
                  </AlertDescription>
                </Alert>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Cleanup Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle>Data Cleanup</CardTitle>
                <CardDescription>Configure automatic cleanup of old task data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="cleanup_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Automatic Cleanup</FormLabel>
                        <FormDescription>
                          Automatically remove old task results and logs
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cleanup_interval_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cleanup Interval (Hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={168}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 6)}
                          disabled={!cleanupEnabled}
                        />
                      </FormControl>
                      <FormDescription>
                        How often to run the cleanup task. Default: 6 hours
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cleanup_age_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Retention (Hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={720}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 24)}
                          disabled={!cleanupEnabled}
                        />
                      </FormControl>
                      <FormDescription>
                        Remove task results and logs older than this. Default: 24 hours
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => triggerCleanup.mutate()}
                    disabled={triggerCleanup.isPending}
                    className="w-full"
                  >
                    {triggerCleanup.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Run Cleanup Now
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Queue Configuration */}
      <FormField
        control={form.control}
        name="queues"
        render={({ field }) => (
          <QueueConfigList
            queues={field.value || []}
            onChange={(queues) => field.onChange(queues)}
          />
        )}
      />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saveSettings.isPending || !form.formState.isDirty}>
          {saveSettings.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
