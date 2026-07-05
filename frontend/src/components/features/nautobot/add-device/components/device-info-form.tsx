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
import type { DeviceFormValues } from '../utils/validation'
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
  onOpenRack?: () => void
  onOpenStack?: () => void
  onUseDefaultValues?: () => void
  selectedTagsCount: number
  isRackConfigured?: boolean
  isStackConfigured?: boolean
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
  onOpenRack,
  onOpenStack,
  onUseDefaultValues,
  selectedTagsCount,
  isRackConfigured = false,
  isStackConfigured = false,
}: DeviceInfoFormProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form

  return (
    <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
      <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Device Information</span>
        </div>
        <div className="flex gap-2">
          {onUseDefaultValues && (
            <Button
              type="button"
              size="sm"
              onClick={onUseDefaultValues}
              disabled={isLoading}
              className="bg-card text-primary hover:bg-info border-info-border h-7 text-xs"
            >
              Use Default Values
            </Button>
          )}
          {onOpenStack && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenStack}
              disabled={isLoading}
              className="bg-card text-primary hover:bg-info border-info-border h-7 text-xs"
            >
              Stack {isStackConfigured && '(configured)'}
            </Button>
          )}
          {onOpenRack && (
            <Button
              type="button"
              size="sm"
              onClick={onOpenRack}
              disabled={isLoading}
              className="bg-card text-primary hover:bg-info border-info-border h-7 text-xs"
            >
              Rack {isRackConfigured && '(configured)'}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={onOpenTags}
            disabled={isLoading}
            className="bg-card text-primary hover:bg-info border-info-border h-7 text-xs"
          >
            Tags {selectedTagsCount > 0 && `(${selectedTagsCount})`}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onOpenCustomFields}
            disabled={isLoading}
            className="bg-card text-primary hover:bg-info border-info-border h-7 text-xs"
          >
            Custom Fields
          </Button>
        </div>
      </div>
      <div className="p-6 panel-content">
        <div className="grid grid-cols-2 gap-4">
          {/* Device Name */}
          <div className="space-y-1">
            <Label htmlFor="deviceName" className="text-xs font-medium">
              Device Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="deviceName"
              {...register('deviceName')}
              disabled={isLoading}
              className="border-2 border-border bg-card focus:border-primary focus:ring-2 focus:ring-ring/30 shadow-sm"
            />
            {errors.deviceName && (
              <p className="text-xs text-destructive">{errors.deviceName.message}</p>
            )}
          </div>

          {/* Serial Number */}
          <div className="space-y-1">
            <Label htmlFor="serialNumber" className="text-xs font-medium">
              Serial Number
            </Label>
            <Input
              id="serialNumber"
              {...register('serialNumber')}
              disabled={isLoading}
              className="border-2 border-border bg-card focus:border-primary focus:ring-2 focus:ring-ring/30 shadow-sm"
            />
          </div>

          {/* Role */}
          <div className="space-y-1">
            <Label htmlFor="selectedRole" className="text-xs font-medium">
              Device Role <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch('selectedRole') ?? ''}
              onValueChange={value => setValue('selectedRole', value)}
              disabled={isLoading}
            >
              <SelectTrigger
                id="selectedRole"
                className="border-2 border-border bg-card focus:border-primary focus:ring-2 focus:ring-ring/30 shadow-sm disabled:bg-muted disabled:border-border"
              >
                <SelectValue placeholder="Select role..." />
              </SelectTrigger>
              <SelectContent>
                {dropdownData.roles.map(role => (
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
              value={watch('selectedStatus') ?? ''}
              onValueChange={value => setValue('selectedStatus', value)}
              disabled={isLoading}
            >
              <SelectTrigger
                id="selectedStatus"
                className="border-2 border-border bg-card focus:border-primary focus:ring-2 focus:ring-ring/30 shadow-sm disabled:bg-muted disabled:border-border"
              >
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {dropdownData.statuses.map(status => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.selectedStatus && (
              <p className="text-xs text-destructive">
                {errors.selectedStatus.message}
              </p>
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
            renderItem={loc => <div>{loc.hierarchicalPath || loc.name}</div>}
            getItemKey={loc => loc.id}
          />

          {/* Device Type (Searchable) */}
          <SearchableDropdownInput
            id="selectedDeviceType"
            label="Device Type"
            placeholder="Search device type..."
            required
            disabled={isLoading}
            dropdownState={deviceTypeDropdown}
            renderItem={dt => {
              // Extract manufacturer from display field (e.g., "NetworkInc networkA" -> "NetworkInc")
              const displayParts = (dt.display || '').split(' ')
              const manufacturer =
                displayParts.length > 1 ? displayParts.slice(0, -1).join(' ') : ''
              return (
                <div className="flex items-center gap-2">
                  {manufacturer ? (
                    <span key="manufacturer" className="text-primary font-medium">
                      {manufacturer}
                    </span>
                  ) : null}
                  <span key="model" className="font-medium">
                    {dt.model}
                  </span>
                </div>
              )
            }}
            getItemKey={dt => dt.id}
          />

          {/* Platform */}
          <div className="space-y-1">
            <Label htmlFor="selectedPlatform" className="text-xs font-medium">
              Platform
            </Label>
            <Select
              value={watch('selectedPlatform') ?? ''}
              onValueChange={value => setValue('selectedPlatform', value)}
              disabled={isLoading}
            >
              <SelectTrigger
                id="selectedPlatform"
                className="border-2 border-border bg-card focus:border-primary focus:ring-2 focus:ring-ring/30 shadow-sm disabled:bg-muted disabled:border-border"
              >
                <SelectValue placeholder="Select platform..." />
              </SelectTrigger>
              <SelectContent>
                {dropdownData.platforms.map(platform => (
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
            renderItem={sv => (
              <div>
                {sv.platform?.name ? (
                  <span key="platform" className="text-xs text-muted-foreground">
                    {sv.platform.name}{' '}
                  </span>
                ) : null}
                <span key="version">{sv.version}</span>
              </div>
            )}
            getItemKey={sv => sv.id}
          />
        </div>
      </div>
    </div>
  )
}
