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
import { useTagsManager } from './hooks/use-tags-manager'
import { useCustomFieldsManager } from './hooks/use-custom-fields-manager'
import { usePropertiesModal } from './hooks/use-properties-modal'
import {
  VMInfoSection,
  ClusterSection,
  ManagementSection,
  ResourcesSection,
  InterfaceList,
  InterfacePropertiesModal,
  TagsModal,
  CustomFieldsModal,
} from './components'
import {
  EMPTY_DROPDOWN_OPTIONS,
  EMPTY_CLUSTERS,
  EMPTY_SOFTWARE_IMAGES,
  EMPTY_SOFTWARE_VERSIONS,
  EMPTY_INTERFACE_TYPES,
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
      interfaceTypes: EMPTY_INTERFACE_TYPES,
      interfaceStatuses: EMPTY_DROPDOWN_OPTIONS,
      ipRoles: EMPTY_DROPDOWN_OPTIONS,
    },
    isLoading: isLoadingDropdowns,
  } = useVMDropdownsQuery()

  // VM form with react-hook-form + Zod
  const form = useVMForm()
  const { reset } = form

  // VM mutations
  const { createVM } = useVMMutations()

  // Tags & Custom Fields managers
  const tagsManager = useTagsManager()
  const customFieldsManager = useCustomFieldsManager()

  // Interface properties modal
  const propertiesModal = usePropertiesModal()

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
      setStatusMessage({ type: 'info', message: 'Creating virtual machine...' })
      try {
        // Filter out incomplete interfaces (interfaces without name or status)
        // Note: Virtual interfaces don't have a 'type' field like physical interfaces
        // It's perfectly fine to have NO interfaces at all - VM creation only requires name, status, and cluster
        const validInterfaces = (formData.interfaces || []).filter((iface) => {
          return iface.name && iface.name.trim() !== '' &&
                 iface.status && iface.status.trim() !== ''
        })

        // Clean up the form data: convert empty strings to undefined so they're omitted from the request
        // This is important because the backend expects Optional fields to be either valid values or None/null
        const cleanedData: Record<string, unknown> = {
          name: formData.name,
          status: formData.status,
          cluster: formData.cluster,
        }

        // Add optional fields only if they have non-empty values
        if (formData.role && formData.role.trim() !== '') cleanedData.role = formData.role
        if (formData.clusterGroup && formData.clusterGroup.trim() !== '') cleanedData.clusterGroup = formData.clusterGroup
        if (formData.platform && formData.platform.trim() !== '') cleanedData.platform = formData.platform
        if (formData.softwareVersion && formData.softwareVersion.trim() !== '') cleanedData.softwareVersion = formData.softwareVersion
        if (formData.softwareImageFile && formData.softwareImageFile.trim() !== '') cleanedData.softwareImageFile = formData.softwareImageFile
        if (formData.vcpus != null && Number(formData.vcpus) > 0) cleanedData.vcpus = formData.vcpus
        if (formData.memory != null && Number(formData.memory) > 0) cleanedData.memory = formData.memory
        if (formData.disk != null && Number(formData.disk) > 0) cleanedData.disk = formData.disk

        // Add valid interfaces
        cleanedData.interfaces = validInterfaces

        // Add tags and custom fields
        if (tagsManager.selectedTags.length > 0) cleanedData.tags = tagsManager.selectedTags
        if (Object.keys(customFieldsManager.customFieldValues).length > 0) {
          cleanedData.customFieldValues = customFieldsManager.customFieldValues
        }

        const result = await createVM.mutateAsync(cleanedData as VMFormValues)

        // Don't reset form - allow user to add similar VMs
        // Show success message
        if (result.success) {
          setStatusMessage({
            type: result.messageType,
            message: `✓ Virtual machine '${formData.name}' created successfully`,
          })
          // Clear message after 3 seconds
          setTimeout(() => setStatusMessage(null), 3000)
        }
      } catch (error) {
        // Error handling is done in the mutation hook
        console.error('VM creation failed:', error)
        setStatusMessage({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to create virtual machine',
        })
      }
    },
    [createVM, tagsManager, customFieldsManager]
  )

  // Handle validation errors
  const onInvalid = useCallback((errors: unknown) => {
    console.error('Form validation failed:', errors)
    setStatusMessage({
      type: 'error',
      message: 'Please fill in all required fields: VM name, status, and cluster. All other fields (including interfaces and IP addresses) are optional.',
    })
  }, [])

  // Clear form
  const handleClear = useCallback(() => {
    reset()
    tagsManager.clearSelectedTags()
    customFieldsManager.clearFieldValues()
    setStatusMessage(null)
  }, [reset, tagsManager, customFieldsManager])

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
            <p className="text-muted-foreground mt-2">
              Create a new VM in Nautobot. Only name, status, and cluster are required.
            </p>
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

      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        <VMInfoSection
          form={form}
          dropdownData={dropdownData}
          isLoading={isLoadingDropdowns}
          onOpenTags={tagsManager.openModal}
          onOpenCustomFields={customFieldsManager.openModal}
          selectedTagsCount={tagsManager.selectedTags.length}
        />
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

        {/* Network Interfaces */}
        <InterfaceList
          form={form}
          dropdownData={dropdownData}
          onOpenProperties={(id) => {
            propertiesModal.openModal(id)
          }}
          isLoading={createVM.isPending}
        />

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

      {/* Modals */}
      <TagsModal
        show={tagsManager.showModal}
        onClose={tagsManager.closeModal}
        availableTags={tagsManager.availableTags}
        selectedTags={tagsManager.selectedTags}
        onToggleTag={tagsManager.toggleTag}
        isLoading={tagsManager.isLoading}
      />

      <CustomFieldsModal
        show={customFieldsManager.showModal}
        onClose={customFieldsManager.closeModal}
        customFields={customFieldsManager.customFields}
        customFieldValues={customFieldsManager.customFieldValues}
        onUpdateField={customFieldsManager.updateFieldValue}
        isLoading={customFieldsManager.isLoading}
        customFieldChoices={customFieldsManager.customFieldChoices}
      />

      <InterfacePropertiesModal
        form={form}
        interfaceId={propertiesModal.currentInterfaceId}
        vlans={propertiesModal.vlans}
        isLoadingVlans={propertiesModal.isLoadingVlans}
        show={propertiesModal.showModal}
        onClose={propertiesModal.closeModal}
      />
    </div>
  )
}
