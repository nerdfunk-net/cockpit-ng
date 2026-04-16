'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { Server, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import { useCelerySettings } from '../hooks/use-celery-queries'
import { useCeleryMutations } from '../hooks/use-celery-mutations'
import type { CelerySettings } from '../types'
import { DEFAULT_CELERY_SETTINGS } from '../utils/constants'
import { QueueConfigList } from './queue-config-list'

const celerySettingsSchema = z.object({
  max_workers: z.number().min(1).max(32),
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
  const { saveSettings } = useCeleryMutations()

  const form = useForm<CelerySettingsFormData>({
    resolver: zodResolver(celerySettingsSchema),
    values: settings ?? DEFAULT_CELERY_SETTINGS,
  })

  const handleSubmit = form.handleSubmit((data) => {
    // Merge with full settings so cleanup fields are preserved
    saveSettings.mutate({ ...(settings ?? DEFAULT_CELERY_SETTINGS), ...data } as CelerySettings)
  })

  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
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

                <Alert className="status-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-medium">Restart Required:</span> Changes to worker configuration require restarting the Celery worker to take effect.
                  </AlertDescription>
                </Alert>
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
