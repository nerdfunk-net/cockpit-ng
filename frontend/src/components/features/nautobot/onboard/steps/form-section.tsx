'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw, Plus } from 'lucide-react'
import { OnboardingFormFields } from '../components/onboarding-form-fields'
import type { DropdownOption, IPValidation, LocationItem, OnboardFormData } from '../types'

interface FormSectionProps {
  formData: OnboardFormData
  ipValidation: IPValidation
  locations: LocationItem[]
  namespaces: DropdownOption[]
  deviceRoles: DropdownOption[]
  platforms: DropdownOption[]
  deviceStatuses: DropdownOption[]
  interfaceStatuses: DropdownOption[]
  ipAddressStatuses: DropdownOption[]
  prefixStatuses: DropdownOption[]
  secretGroups: DropdownOption[]
  locationSearchValue: string
  deviceSearchQuery: string
  selectedTagsCount: number
  isValidatingIP: boolean
  isSearchingDevice: boolean
  isSubmittingOnboard: boolean
  onIPChange: (value: string) => void
  onFormDataChange: (field: keyof OnboardFormData, value: string | number) => void
  onSyncOptionChange: (option: string, checked: boolean) => void
  onLocationSelect: (location: LocationItem) => void
  onCheckIP: () => void
  onSearchDevice: () => void
  onDeviceSearchQueryChange: (query: string) => void
  onShowTagsModal: () => void
  onShowCustomFieldsModal: () => void
  onSubmit: () => void
}

export function FormSection({
  formData,
  ipValidation,
  locations,
  namespaces,
  deviceRoles,
  platforms,
  deviceStatuses,
  interfaceStatuses,
  ipAddressStatuses,
  prefixStatuses,
  secretGroups,
  locationSearchValue,
  deviceSearchQuery,
  selectedTagsCount,
  isValidatingIP,
  isSearchingDevice,
  isSubmittingOnboard,
  onIPChange,
  onFormDataChange,
  onSyncOptionChange,
  onLocationSelect,
  onCheckIP,
  onSearchDevice,
  onDeviceSearchQueryChange,
  onShowTagsModal,
  onShowCustomFieldsModal,
  onSubmit,
}: FormSectionProps) {
  return (
    <>
      <OnboardingFormFields
        formData={formData}
        ipValidation={ipValidation}
        locations={locations}
        namespaces={namespaces}
        deviceRoles={deviceRoles}
        platforms={platforms}
        deviceStatuses={deviceStatuses}
        interfaceStatuses={interfaceStatuses}
        ipAddressStatuses={ipAddressStatuses}
        prefixStatuses={prefixStatuses}
        secretGroups={secretGroups}
        locationSearchValue={locationSearchValue}
        deviceSearchQuery={deviceSearchQuery}
        selectedTagsCount={selectedTagsCount}
        onIPChange={onIPChange}
        onFormDataChange={onFormDataChange}
        onSyncOptionChange={onSyncOptionChange}
        onLocationSelect={onLocationSelect}
        onCheckIP={onCheckIP}
        onSearchDevice={onSearchDevice}
        onDeviceSearchQueryChange={onDeviceSearchQueryChange}
        onShowTagsModal={onShowTagsModal}
        onShowCustomFieldsModal={onShowCustomFieldsModal}
        isValidatingIP={isValidatingIP}
        isSearchingDevice={isSearchingDevice}
      />

      <div className="flex items-center space-x-4 pt-4">
        <Button
          onClick={onSubmit}
          disabled={isSubmittingOnboard || !ipValidation.isValid}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-8 text-sm"
        >
          {isSubmittingOnboard ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Starting Onboarding...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Onboard Device
            </>
          )}
        </Button>
        <p className="text-sm text-slate-500">
          Required fields are marked with <span className="text-red-500">*</span>
        </p>
      </div>
    </>
  )
}
