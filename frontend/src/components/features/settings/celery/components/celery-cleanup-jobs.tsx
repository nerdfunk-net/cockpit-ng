'use client'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { Trash2, Save, RefreshCw, Database } from 'lucide-react'
import { useCelerySettings } from '../hooks/use-celery-queries'
import { useCeleryMutations } from '../hooks/use-celery-mutations'
import type { CelerySettings } from '../types'
import { DEFAULT_CELERY_SETTINGS } from '../utils/constants'

const cleanupJobsSchema = z.object({
  cleanup_enabled: z.boolean(),
  cleanup_interval_hours: z.number().min(1).max(168),
  cleanup_age_hours: z.number().min(1).max(720),
  client_data_cleanup_enabled: z.boolean(),
  client_data_cleanup_interval_hours: z.number().min(1).max(168),
  client_data_cleanup_age_hours: z.number().min(1).max(8760),
})

type CleanupJobsFormData = z.infer<typeof cleanupJobsSchema>

export function CeleryCleanupJobs() {
  const { data: settings, isLoading } = useCelerySettings()
  const { saveSettings, triggerCleanup, triggerClientDataCleanup } = useCeleryMutations()

  const form = useForm<CleanupJobsFormData>({
    resolver: zodResolver(cleanupJobsSchema),
    values: settings ?? DEFAULT_CELERY_SETTINGS,
  })

  const cleanupEnabled = useWatch({ control: form.control, name: 'cleanup_enabled' })
  const clientDataCleanupEnabled = useWatch({ control: form.control, name: 'client_data_cleanup_enabled' })

  const handleSubmit = form.handleSubmit((data) => {
    // Merge with full settings so worker/queue fields are preserved
    saveSettings.mutate({ ...(settings ?? DEFAULT_CELERY_SETTINGS), ...data } as CelerySettings)
  })

  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Data Cleanup */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <div>
                <CardTitle>Data Cleanup</CardTitle>
                <CardDescription>Configure automatic cleanup of old task results and logs</CardDescription>
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

        {/* Cleanup Client Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-orange-500" />
              <div>
                <CardTitle>Cleanup Client Data</CardTitle>
                <CardDescription>Configure automatic cleanup of old ARP, MAC address, and hostname data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="client_data_cleanup_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Automatic Cleanup</FormLabel>
                        <FormDescription>
                          Automatically remove old and unused client data
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
                  name="client_data_cleanup_interval_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cleanup Interval (Hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={168}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 24)}
                          disabled={!clientDataCleanupEnabled}
                        />
                      </FormControl>
                      <FormDescription>
                        How often to run the cleanup task. Default: 24 hours
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_data_cleanup_age_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Retention (Hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={8760}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 168)}
                          disabled={!clientDataCleanupEnabled}
                        />
                      </FormControl>
                      <FormDescription>
                        Remove client data older than this. Default: 168 hours (7 days)
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
                    onClick={() => triggerClientDataCleanup.mutate()}
                    disabled={triggerClientDataCleanup.isPending}
                    className="w-full"
                  >
                    {triggerClientDataCleanup.isPending ? (
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
