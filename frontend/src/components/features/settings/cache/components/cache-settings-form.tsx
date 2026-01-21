'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Save, RefreshCw, Settings } from 'lucide-react'
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form'
import { useCacheSettings } from '../hooks/use-cache-queries'
import { useCacheMutations } from '../hooks/use-cache-mutations'
import { useEffect } from 'react'
import type { CacheSettings } from '../types'
import { DEFAULT_CACHE_SETTINGS } from '../utils/constants'

const cacheSettingsSchema = z.object({
  enabled: z.boolean(),
  ttl_seconds: z.number().min(30).max(3600),
  prefetch_on_startup: z.boolean(),
  refresh_interval_minutes: z.number().min(1).max(1440),
  max_commits: z.number().min(50).max(10000),
  prefetch_items: z.object({
    git: z.boolean(),
    locations: z.boolean(),
    devices: z.boolean(),
  }),
  devices_cache_interval_minutes: z.number().min(0).max(1440),
  locations_cache_interval_minutes: z.number().min(0).max(1440),
  git_commits_cache_interval_minutes: z.number().min(0).max(1440),
})

type CacheSettingsFormData = z.infer<typeof cacheSettingsSchema>

export function CacheSettingsForm() {
  const { data: settings, isLoading } = useCacheSettings()
  const { saveSettings } = useCacheMutations()

  const form = useForm<CacheSettingsFormData>({
    resolver: zodResolver(cacheSettingsSchema),
    defaultValues: {
      enabled: DEFAULT_CACHE_SETTINGS.enabled!,
      ttl_seconds: DEFAULT_CACHE_SETTINGS.ttl_seconds!,
      prefetch_on_startup: DEFAULT_CACHE_SETTINGS.prefetch_on_startup!,
      refresh_interval_minutes: DEFAULT_CACHE_SETTINGS.refresh_interval_minutes!,
      max_commits: DEFAULT_CACHE_SETTINGS.max_commits!,
      prefetch_items: {
        git: DEFAULT_CACHE_SETTINGS.prefetch_items?.git || false,
        locations: DEFAULT_CACHE_SETTINGS.prefetch_items?.locations || false,
        devices: DEFAULT_CACHE_SETTINGS.prefetch_items?.devices || false,
      },
      devices_cache_interval_minutes: DEFAULT_CACHE_SETTINGS.devices_cache_interval_minutes!,
      locations_cache_interval_minutes: DEFAULT_CACHE_SETTINGS.locations_cache_interval_minutes!,
      git_commits_cache_interval_minutes: DEFAULT_CACHE_SETTINGS.git_commits_cache_interval_minutes!,
    },
  })

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset(settings)
    }
  }, [settings, form])

  const handleSubmit = form.handleSubmit((data) => {
    saveSettings.mutate(data as CacheSettings)
  })

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <div>
              <h1 className="text-sm font-semibold">Cache Configuration</h1>
              <p className="text-blue-100 text-xs">Loading settings...</p>
            </div>
          </div>
        </div>
        <div className="p-6 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <div>
            <h1 className="text-sm font-semibold">Cache Configuration</h1>
            <p className="text-blue-100 text-xs">Configure caching behavior to optimize performance</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enable Cache */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-medium">Enable Cache</FormLabel>
                    <FormDescription>
                      Turn caching on or off globally
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

            <Separator />

            {/* TTL */}
            <FormField
              control={form.control}
              name="ttl_seconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TTL (Time To Live) - Seconds</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={30}
                      step={30}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 600)}
                    />
                  </FormControl>
                  <FormDescription>
                    How long to keep cached items before refreshing (minimum 30 seconds)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Prefetch on Startup */}
            <FormField
              control={form.control}
              name="prefetch_on_startup"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-medium">Prefetch on Startup</FormLabel>
                    <FormDescription>
                      Warm the cache when the backend starts
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

            {/* Prefetch Items */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Startup Prefetch Items</Label>
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="prefetch_items.git"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <Label className="text-sm font-normal">
                          Git commits
                        </Label>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prefetch_items.locations"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <Label className="text-sm font-normal">
                          Locations
                        </Label>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prefetch_items.devices"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <Label className="text-sm font-normal">
                          Devices
                        </Label>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-sm text-gray-500">
                Select items to warm on backend startup
              </p>
            </div>

            {/* Max Commits */}
            <FormField
              control={form.control}
              name="max_commits"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Commits</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={50}
                      step={50}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 500)}
                    />
                  </FormControl>
                  <FormDescription>
                    Limit how many commits are prefetched and returned
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Cache Task Intervals Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium">Background Cache Tasks</h3>
                <p className="text-sm text-gray-500">
                  Configure how often background tasks refresh the cache. Set to 0 to disable a task.
                  These tasks will appear in Jobs → View.
                </p>
              </div>

              {/* Devices Cache Interval */}
              <FormField
                control={form.control}
                name="devices_cache_interval_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Devices Cache Interval (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={5}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      How often to refresh the devices cache from Nautobot (0 = disabled)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Locations Cache Interval */}
              <FormField
                control={form.control}
                name="locations_cache_interval_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Locations Cache Interval (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      How often to refresh the locations cache from Nautobot (0 = disabled)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Git Commits Cache Interval */}
              <FormField
                control={form.control}
                name="git_commits_cache_interval_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Git Commits Cache Interval (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      How often to refresh the git commits cache (0 = disabled)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={saveSettings.isPending || !form.formState.isDirty}
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                {saveSettings.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
