import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { UseFormReturn } from 'react-hook-form'
import { SearchableDropdownInput } from './searchable-dropdown-input'
import type { DeviceFormValues } from '../validation'
import type {
  NautobotDropdownsResponse,
  LocationItem,
  DeviceType,
  SoftwareVersion,
} from '../types'
import type { SearchableDropdownState } from '../hooks/use-searchable-dropdown'

interface DeviceInfoFormProps {
  form: UseFormReturn<DeviceFormValues>
  dropdownData: NautobotDropdownsResponse
  locationDropdown: SearchableDropdownState<LocationItem>
  deviceTypeDropdown: SearchableDropdownState<DeviceType>
  softwareVersionDropdown: SearchableDropdownState<SoftwareVersion>
  isLoading: boolean
  onOpenTags: () => void
  onOpenCustomFields: () => void
  selectedTagsCount: number
}

export function DeviceInfoForm({
  form,
  dropdownData,
  locationDropdown,
  deviceTypeDropdown,
  softwareVersionDropdown,
  isLoading,
  onOpenTags,
  onOpenCustomFields,
  selectedTagsCount,
}: DeviceInfoFormProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form

  return (
    <div className="rounded-xl border shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Device Information</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenTags}
            disabled={isLoading}
          >
            Tags {selectedTagsCount > 0 && `(${selectedTagsCount})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenCustomFields}
            disabled={isLoading}
          >
            Custom Fields
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Device Name */}
        <div className="space-y-1">
          <Label htmlFor="deviceName" className="text-xs font-medium">
            Device Name <span className="text-destructive">*</span>
          </Label>
          <Input id="deviceName" {...register('deviceName')} disabled={isLoading} />
          {errors.deviceName && (
            <p className="text-xs text-destructive">{errors.deviceName.message}</p>
          )}
        </div>

        {/* Serial Number */}
        <div className="space-y-1">
          <Label htmlFor="serialNumber" className="text-xs font-medium">
            Serial Number
          </Label>
          <Input id="serialNumber" {...register('serialNumber')} disabled={isLoading} />
        </div>

        {/* Role */}
        <div className="space-y-1">
          <Label htmlFor="selectedRole" className="text-xs font-medium">
            Device Role <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('selectedRole')}
            onValueChange={(value) => setValue('selectedRole', value)}
            disabled={isLoading}
          >
            <SelectTrigger id="selectedRole">
              <SelectValue placeholder="Select role..." />
            </SelectTrigger>
            <SelectContent>
              {dropdownData.roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.selectedRole && (
            <p className="text-xs text-destructive">{errors.selectedRole.message}</p>
          )}
        </div>

        {/* Status */}
        <div className="space-y-1">
          <Label htmlFor="selectedStatus" className="text-xs font-medium">
            Device Status <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('selectedStatus')}
            onValueChange={(value) => setValue('selectedStatus', value)}
            disabled={isLoading}
          >
            <SelectTrigger id="selectedStatus">
              <SelectValue placeholder="Select status..." />
            </SelectTrigger>
            <SelectContent>
              {dropdownData.statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.selectedStatus && (
            <p className="text-xs text-destructive">{errors.selectedStatus.message}</p>
          )}
        </div>

        {/* Location (Searchable) */}
        <SearchableDropdownInput
          id="selectedLocation"
          label="Location"
          placeholder="Search location..."
          required
          disabled={isLoading}
          dropdownState={locationDropdown}
          renderItem={(loc) => <div>{loc.hierarchicalPath || loc.name}</div>}
          getItemKey={(loc) => loc.id}
        />

        {/* Device Type (Searchable) */}
        <SearchableDropdownInput
          id="selectedDeviceType"
          label="Device Type"
          placeholder="Search device type..."
          required
          disabled={isLoading}
          dropdownState={deviceTypeDropdown}
          renderItem={(dt) => (
            <div>
              <div className="font-medium">{dt.model}</div>
              <div className="text-xs text-muted-foreground">
                {dt.manufacturer.name || dt.manufacturer.display}
              </div>
            </div>
          )}
          getItemKey={(dt) => dt.id}
        />

        {/* Platform */}
        <div className="space-y-1">
          <Label htmlFor="selectedPlatform" className="text-xs font-medium">
            Platform
          </Label>
          <Select
            value={watch('selectedPlatform')}
            onValueChange={(value) => setValue('selectedPlatform', value)}
            disabled={isLoading}
          >
            <SelectTrigger id="selectedPlatform">
              <SelectValue placeholder="Select platform..." />
            </SelectTrigger>
            <SelectContent>
              {dropdownData.platforms.map((platform) => (
                <SelectItem key={platform.id} value={platform.id}>
                  {platform.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Software Version (Searchable) */}
        <SearchableDropdownInput
          id="selectedSoftwareVersion"
          label="Software Version"
          placeholder="Search version..."
          disabled={isLoading}
          dropdownState={softwareVersionDropdown}
          renderItem={(sv) => (
            <div>
              {sv.platform?.name && (
                <span className="text-xs text-muted-foreground">{sv.platform.name} </span>
              )}
              {sv.version}
            </div>
          )}
          getItemKey={(sv) => sv.id}
        />
      </div>
    </div>
  )
}
