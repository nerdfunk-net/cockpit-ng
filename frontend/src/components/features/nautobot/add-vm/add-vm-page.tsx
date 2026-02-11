'use client'

import { useState, useCallback, useMemo } from 'react'
import { Monitor, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

import {
  useVMDropdownsQuery,
  useSoftwareVersionsQuery,
  useSoftwareImageFilesQuery,
  useVMMutations,
} from './hooks/queries'
import { useVMForm, type VMFormValues } from './hooks/use-vm-form'
import {
  VMInfoSection,
  ClusterSection,
  ManagementSection,
  ResourcesSection,
  TagsSection,
} from './components'
import {
  EMPTY_DROPDOWN_OPTIONS,
  EMPTY_CLUSTERS,
  EMPTY_SOFTWARE_IMAGES,
  EMPTY_SOFTWARE_VERSIONS,
} from './constants'
import type { StatusMessage } from './types'

export function AddVMPage() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Fetch all dropdown data with TanStack Query
  const {
    data: dropdownData = {
      roles: EMPTY_DROPDOWN_OPTIONS,
      statuses: EMPTY_DROPDOWN_OPTIONS,
      clusters: EMPTY_CLUSTERS,
      clusterGroups: EMPTY_DROPDOWN_OPTIONS,
      platforms: EMPTY_DROPDOWN_OPTIONS,
      namespaces: EMPTY_DROPDOWN_OPTIONS,
      tags: EMPTY_DROPDOWN_OPTIONS,
    },
    isLoading: isLoadingDropdowns,
  } = useVMDropdownsQuery()

  // VM form with react-hook-form + Zod
  const form = useVMForm()
  const { reset } = form

  // VM mutations
  const { createVM } = useVMMutations()

  // Resolve selected platform ID → name for the software versions filter
  const selectedPlatformId = form.watch('platform')
  const selectedPlatformName = useMemo(() => {
    if (!selectedPlatformId) return undefined
    return dropdownData.platforms.find((p) => p.id === selectedPlatformId)?.name
  }, [selectedPlatformId, dropdownData.platforms])

  // Fetch software versions filtered by selected platform
  const {
    data: softwareVersions = EMPTY_SOFTWARE_VERSIONS,
    isLoading: isLoadingSoftwareVersions,
  } = useSoftwareVersionsQuery({ platformName: selectedPlatformName })

  // Resolve selected software version ID → display string for the image files filter
  const selectedSoftwareVersionId = form.watch('softwareVersion')
  const selectedSoftwareVersionName = useMemo(() => {
    if (!selectedSoftwareVersionId) return undefined
    const sv = softwareVersions.find((v) => v.id === selectedSoftwareVersionId)
    if (!sv) return undefined
    return sv.version
  }, [selectedSoftwareVersionId, softwareVersions])

  // Fetch software image files filtered by selected software version
  const {
    data: softwareImageFiles = EMPTY_SOFTWARE_IMAGES,
    isLoading: isLoadingSoftwareImageFiles,
  } = useSoftwareImageFilesQuery({ softwareVersion: selectedSoftwareVersionName })

  // Form submission
  const onSubmit = useCallback(
    async (formData: VMFormValues) => {
      setStatusMessage(null)
      try {
        await createVM.mutateAsync(formData)
        // Reset form on success
        reset()
      } catch (error) {
        // Error handling is done in the mutation hook
        console.error('VM creation failed:', error)
      }
    },
    [createVM, reset]
  )

  // Clear form
  const handleClear = useCallback(() => {
    reset()
    setStatusMessage(null)
  }, [reset])

  // Full-page loading state
  if (isLoadingDropdowns) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Monitor className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Add Virtual Machine</h1>
            <p className="text-muted-foreground mt-2">Create a new VM in Nautobot</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Monitor className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Add Virtual Machine</h1>
            <p className="text-muted-foreground mt-2">Create a new VM in Nautobot</p>
          </div>
        </div>
      </div>

      {/* Status message */}
      {statusMessage && (
        <Alert
          className={
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200'
              : statusMessage.type === 'error'
                ? 'bg-red-50 border-red-200'
                : 'bg-blue-50 border-blue-200'
          }
        >
          <AlertDescription>{statusMessage.message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <VMInfoSection form={form} dropdownData={dropdownData} isLoading={isLoadingDropdowns} />
        <ClusterSection form={form} dropdownData={dropdownData} isLoading={isLoadingDropdowns} />
        <ManagementSection
          form={form}
          dropdownData={dropdownData}
          softwareVersions={softwareVersions}
          isLoadingSoftwareVersions={isLoadingSoftwareVersions}
          softwareImageFiles={softwareImageFiles}
          isLoadingSoftwareImageFiles={isLoadingSoftwareImageFiles}
          isLoading={isLoadingDropdowns}
        />
        <ResourcesSection form={form} isLoading={isLoadingDropdowns} />
        <TagsSection form={form} dropdownData={dropdownData} isLoading={isLoadingDropdowns} />

        {/* Submit buttons */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClear} disabled={createVM.isPending}>
            Clear Form
          </Button>
          <Button type="submit" disabled={createVM.isPending}>
            {createVM.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating VM...
              </>
            ) : (
              'Add Virtual Machine'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
