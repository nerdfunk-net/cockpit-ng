import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form'
import { Loader2, CheckCircle, XCircle, Server, Settings, RotateCcw } from 'lucide-react'
import type { CheckMKSettings } from '../types'

const settingsSchema = z.object({
  url: z.string().url('Invalid URL').min(1, 'URL is required'),
  site: z.string().min(1, 'Site is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  verify_ssl: z.boolean(),
})

type SettingsFormData = z.infer<typeof settingsSchema>

interface ConnectionSettingsFormProps {
  settings: CheckMKSettings
  onSave: (settings: CheckMKSettings) => void
  onTest: (settings: CheckMKSettings) => void
  onReset: () => void
  isSaving?: boolean
  isTesting?: boolean
  testStatus?: 'idle' | 'success' | 'error'
  testMessage?: string
}

export function ConnectionSettingsForm({
  settings,
  onSave,
  onTest,
  onReset,
  isSaving = false,
  isTesting = false,
  testStatus = 'idle',
  testMessage = '',
}: ConnectionSettingsFormProps) {
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
    values: settings, // Sync with external settings
  })

  const handleSave = form.handleSubmit((data) => {
    onSave(data)
  })

  const handleTest = form.handleSubmit((data) => {
    onTest(data)
  })

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Settings className="h-4 w-4" />
          <span>CheckMK Connection Settings</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
        <Form {...form}>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CheckMK URL */}
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      CheckMK Server URL <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://checkmk.example.com" {...field} />
                    </FormControl>
                    <FormDescription>The base URL of your CheckMK instance</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Site */}
              <FormField
                control={form.control}
                name="site"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Site <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter your CheckMK site name (e.g., 'cmk')"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The CheckMK site name (usually &apos;cmk&apos; for default installations)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Username */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Username <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="Enter your CheckMK username" {...field} />
                    </FormControl>
                    <FormDescription>Your CheckMK login username</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Password <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter your CheckMK password" {...field} />
                    </FormControl>
                    <FormDescription>Your CheckMK login password or API key</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SSL Verification */}
              <FormField
                control={form.control}
                name="verify_ssl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SSL Verification</FormLabel>
                    <div className="flex items-center space-x-2 p-3 bg-white rounded-lg border border-gray-200">
                      <FormControl>
                        <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} />
                      </FormControl>
                      <label className="text-sm text-gray-700">Verify SSL certificates</label>
                    </div>
                    <FormDescription>Uncheck only for development environments</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Test Connection Button */}
            <div className="pt-4 border-t border-gray-200">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTest}
                      disabled={isTesting || !form.formState.isValid}
                      className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Server className="h-4 w-4" />
                      )}
                      <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                    </Button>

                    {/* Connection Status */}
                    {testStatus === 'success' && (
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Connection successful!</span>
                      </div>
                    )}

                    {testStatus === 'error' && testMessage && (
                      <div className="flex items-center space-x-2 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">{testMessage}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-blue-600 font-medium">
                    Test your connection before saving
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Form>

        {/* Action Buttons - Outside form to prevent submit trigger */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              className="flex items-center space-x-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset to Defaults</span>
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !form.formState.isValid}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 text-base font-medium"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
