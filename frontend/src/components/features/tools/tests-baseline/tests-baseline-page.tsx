'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ChevronDown, ChevronRight, FlaskConical, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import {
  buildManualDistributionRows,
  DEFAULT_FORM_VALUES,
  profileRequestToFormValues,
} from './constants'
import {
  testsBaselineFormSchema,
  type TestsBaselineFormValues,
} from './tests-baseline-schema'
import type {
  BaselineProfileDetail,
  BaselineProfileSummary,
  CreateBaselineRequest,
  CreateBaselineResponse,
} from './types'
import type { ChangeEvent, Ref } from 'react'

function bindNumberInputField(
  value: number,
  onChange: (value: number) => void,
  onBlur: () => void,
  name: string,
  ref: Ref<HTMLInputElement>,
  fallback = 0
) {
  return {
    name,
    onBlur,
    ref,
    value,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = event.target.valueAsNumber
      onChange(Number.isNaN(parsed) ? fallback : parsed)
    },
  }
}

function sanitizeName(name: string): string {
  return name
    .trim()
    .split('')
    .filter(c => /[a-zA-Z0-9_-]/.test(c))
    .join('')
}

function formValuesToRequest(values: TestsBaselineFormValues): CreateBaselineRequest {
  const request: CreateBaselineRequest = {
    profile: values.profile || undefined,
    name: sanitizeName(values.name) || 'baseline',
    prefixes: values.prefixes,
    network_device_role: values.network_device_role,
    server_role: values.server_role,
    vm_role: values.vm_role,
    tags: values.tags,
    custom_fields: values.custom_fields,
    location_hierarchy: values.location_hierarchy,
    number_of_locations: values.number_of_locations,
    number_of_network_devices: values.number_of_network_devices,
    number_of_servers: values.number_of_servers,
    number_of_virtual_machines: values.number_of_virtual_machines,
    number_of_clusters: values.number_of_clusters,
  }

  if (values.distribution_mode !== 'even') {
    request.distribution = {
      mode: values.distribution_mode,
      seed: values.distribution_seed,
      by_location:
        values.distribution_mode === 'manual'
          ? values.manual_distribution
          : [],
    }
  }

  return request
}

export function BaselineGenerateForm() {
  const { token } = useAuthStore()
  const { toast } = useToast()
  const [showDistribution, setShowDistribution] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<CreateBaselineResponse | null>(
    null
  )
  const [profiles, setProfiles] = useState<BaselineProfileSummary[]>([])
  const [selectedProfile, setSelectedProfile] = useState<string>('custom')

  const defaultManualRows = useMemo(
    () => buildManualDistributionRows(DEFAULT_FORM_VALUES.number_of_locations),
    []
  )

  const form = useForm<TestsBaselineFormValues>({
    resolver: zodResolver(testsBaselineFormSchema),
    defaultValues: {
      ...DEFAULT_FORM_VALUES,
      profile: undefined,
      distribution_mode: 'even',
      distribution_seed: 42,
      manual_distribution: defaultManualRows,
    },
  })

  useEffect(() => {
    if (!token) return
    void (async () => {
      try {
        const response = await fetch('/api/proxy/tools/baseline-profiles', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const data = (await response.json()) as BaselineProfileSummary[]
          setProfiles(data)
        }
      } catch {
        // Profiles are optional for the form
      }
    })()
  }, [token])

  const applyProfile = useCallback(
    async (profileId: string) => {
      if (profileId === 'custom') {
        setSelectedProfile('custom')
        form.reset({
          ...DEFAULT_FORM_VALUES,
          distribution_mode: 'even',
          distribution_seed: 42,
          manual_distribution: buildManualDistributionRows(
            DEFAULT_FORM_VALUES.number_of_locations
          ),
        })
        return
      }
      if (!token) return
      const response = await fetch(
        `/api/proxy/tools/baseline-profiles/${profileId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!response.ok) {
        throw new Error('Failed to load profile')
      }
      const profile = (await response.json()) as BaselineProfileDetail
      setSelectedProfile(profileId)
      form.reset(profileRequestToFormValues(profile))
      if (profile.request.distribution) {
        setShowDistribution(true)
      }
    },
    [form, token]
  )

  const locationCount = useWatch({
    control: form.control,
    name: 'number_of_locations',
    defaultValue: DEFAULT_FORM_VALUES.number_of_locations,
  })
  const distributionMode = useWatch({
    control: form.control,
    name: 'distribution_mode',
    defaultValue: 'even' as const,
  })
  const manualDistribution = useWatch({
    control: form.control,
    name: 'manual_distribution',
    defaultValue: defaultManualRows,
  })

  useEffect(() => {
    if (distributionMode !== 'manual') return

    const count = locationCount ?? DEFAULT_FORM_VALUES.number_of_locations
    const current = form.getValues('manual_distribution')
    // Only resize when location count changes — do not wipe profile rows (e.g. Pytest cities).
    if (current.length === count) return

    form.setValue('manual_distribution', buildManualDistributionRows(count))
  }, [locationCount, distributionMode, form])

  const onInvalid = useCallback(
    (errors: typeof form.formState.errors) => {
      const firstMessage =
        errors.manual_distribution?.message ??
        errors.number_of_clusters?.message ??
        errors.name?.message ??
        'Please fix the highlighted fields before generating.'

      if (errors.manual_distribution) {
        setShowDistribution(true)
      }

      toast({
        title: 'Cannot generate baseline',
        description: firstMessage,
        variant: 'destructive',
      })
    },
    [toast]
  )

  const onSubmit = useCallback(
    async (values: TestsBaselineFormValues) => {
      setIsSubmitting(true)
      setLastResult(null)
      try {
        if (!token) {
          throw new Error('Not authenticated')
        }

        const body = formValuesToRequest(values)
        const response = await fetch('/api/proxy/tools/create-baseline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        })

        const data = await response.json()
        if (!response.ok) {
          const detail =
            typeof data.detail === 'string'
              ? data.detail
              : JSON.stringify(data.detail)
          throw new Error(detail || 'Failed to generate baseline')
        }

        const result = data as CreateBaselineResponse
        setLastResult(result)
        const importHint =
          result.profile === 'pytest'
            ? 'Copy to contributing-data/tests_baseline/ then use Import below.'
            : `Wrote ${result.filename}. Copy to contributing-data/tests_baseline/ then import below.`
        toast({
          title: 'Baseline YAML created',
          description: importHint,
        })
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Failed to generate baseline',
          variant: 'destructive',
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [token, toast]
  )

  return (
    <div className="space-y-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            className="space-y-6"
          >
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Use the Pytest profile for integration-test baseline data (120 devices,
                  City A/B/C layout). Custom unlocks all fields.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-md space-y-2">
                  <Label htmlFor="baseline-profile">Baseline profile</Label>
                  <Select
                    value={selectedProfile}
                    onValueChange={value => {
                      void applyProfile(value).catch(error => {
                        toast({
                          title: 'Error',
                          description:
                            error instanceof Error
                              ? error.message
                              : 'Failed to apply profile',
                          variant: 'destructive',
                        })
                      })
                    }}
                  >
                    <SelectTrigger id="baseline-profile">
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom</SelectItem>
                      {profiles.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>General</CardTitle>
                <CardDescription>
                  Baseline filename, prefixes, roles, tags, and custom field values.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Baseline name</FormLabel>
                    <FormControl>
                      <Input placeholder="baseline" {...field} />
                    </FormControl>
                    <FormDescription>
                      Used as the filename: {'{name}'}.yaml
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prefixes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prefixes</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="192.168.178.0/24,192.168.179.0/24"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Comma-separated CIDR prefixes</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="network_device_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Network device role</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="server_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server role</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vm_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Virtual machine role</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="Production,Staging,lab" {...field} />
                    </FormControl>
                    <FormDescription>Comma-separated tag names</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="custom_fields"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom fields</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="net=netA,checkmk_site=siteA"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated key=value pairs applied to devices and VMs
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Location types</CardTitle>
                <CardDescription>
                  Hierarchy from root to leaf, separated by -&gt;
                </CardDescription>
              </CardHeader>
              <CardContent>
              <FormField
                control={form.control}
                name="location_hierarchy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location hierarchy</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Country -> State -> City -> Building"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Test baseline counts</CardTitle>
                <CardDescription>
                  Leaf locations are named Location A, Location B, and so on.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="number_of_locations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of locations</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...bindNumberInputField(
                          field.value,
                          field.onChange,
                          field.onBlur,
                          field.name,
                          field.ref,
                          1
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="number_of_network_devices"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Network devices</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...bindNumberInputField(
                          field.value,
                          field.onChange,
                          field.onBlur,
                          field.name,
                          field.ref
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="number_of_servers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Servers</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...bindNumberInputField(
                          field.value,
                          field.onChange,
                          field.onBlur,
                          field.name,
                          field.ref
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="number_of_virtual_machines"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Virtual machines</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...bindNumberInputField(
                          field.value,
                          field.onChange,
                          field.onBlur,
                          field.name,
                          field.ref
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="number_of_clusters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clusters</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...bindNumberInputField(
                          field.value,
                          field.onChange,
                          field.onBlur,
                          field.name,
                          field.ref
                        )}
                      />
                    </FormControl>
                    <FormDescription>
                      Required when creating virtual machines
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setShowDistribution(prev => !prev)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Distribution (optional)</CardTitle>
                    <CardDescription>
                      Control how devices are assigned to locations. Default is
                      even round-robin.
                    </CardDescription>
                  </div>
                  {showDistribution ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </CardHeader>
              {showDistribution && (
                <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="distribution_mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mode</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="even">Even (round-robin)</SelectItem>
                          <SelectItem value="random">Random (seeded)</SelectItem>
                          <SelectItem value="manual">Manual per location</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {distributionMode === 'random' && (
                  <FormField
                    control={form.control}
                    name="distribution_seed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Random seed</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...bindNumberInputField(
                              field.value,
                              field.onChange,
                              field.onBlur,
                              field.name,
                              field.ref,
                              42
                            )}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {distributionMode === 'manual' && (
                  <div className="space-y-2">
                    <Label>Counts per location</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Location</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Server</TableHead>
                          <TableHead>VM</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(manualDistribution ?? defaultManualRows).map(
                          (row, index) => (
                          <TableRow key={row.location}>
                            <TableCell className="font-medium">
                              {row.location}
                            </TableCell>
                            {(['network', 'server', 'vm'] as const).map(col => (
                              <TableCell key={col}>
                                <FormField
                                  control={form.control}
                                  name={`manual_distribution.${index}.${col}`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min={0}
                                          className="w-20"
                                          {...bindNumberInputField(
                                            field.value,
                                            field.onChange,
                                            field.onBlur,
                                            field.name,
                                            field.ref
                                          )}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {form.formState.errors.manual_distribution?.message && (
                      <p className="text-sm font-medium text-destructive">
                        {form.formState.errors.manual_distribution.message}
                      </p>
                    )}
                  </div>
                )}
                </CardContent>
              )}
            </Card>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FlaskConical className="w-4 h-4 mr-2" />
                  Generate baseline YAML
                </>
              )}
            </Button>
          </form>
        </Form>

        {lastResult && (
          <Alert className="border-emerald-200 bg-emerald-50/50 shadow-sm">
            <FlaskConical className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-gray-900">
              Generated {lastResult.filename}
            </AlertTitle>
            <AlertDescription className="space-y-2 text-gray-600">
              <p className="font-mono text-sm break-all text-gray-800">
                {lastResult.path}
              </p>
              <p>
                Network: {lastResult.stats.network_devices}, servers:{' '}
                {lastResult.stats.server_devices}, VMs:{' '}
                {lastResult.stats.virtual_machines}, clusters:{' '}
                {lastResult.stats.clusters}
              </p>
              <p className="text-sm text-gray-500">
                Copy this file to{' '}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs border border-gray-200">
                  contributing-data/tests_baseline/
                </code>{' '}
                then use Import test baseline below to load into Nautobot.
              </p>
            </AlertDescription>
          </Alert>
        )}
    </div>
  )
}
