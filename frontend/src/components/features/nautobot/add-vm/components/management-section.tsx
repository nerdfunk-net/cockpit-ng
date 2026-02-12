import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { VMFormReturn } from '../hooks/use-vm-form'
import type { VMDropdownsResponse, SoftwareVersion, SoftwareImageOption } from '../types'

interface ManagementSectionProps {
  form: VMFormReturn
  dropdownData: VMDropdownsResponse
  softwareVersions: SoftwareVersion[]
  isLoadingSoftwareVersions: boolean
  softwareImageFiles: SoftwareImageOption[]
  isLoadingSoftwareImageFiles: boolean
  isLoading: boolean
}

export function ManagementSection({
  form,
  dropdownData,
  softwareVersions,
  isLoadingSoftwareVersions,
  softwareImageFiles,
  isLoadingSoftwareImageFiles,
  isLoading,
}: ManagementSectionProps) {
  const { setValue, watch } = form

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
        <span className="text-sm font-medium">Management</span>
      </div>
      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        {/* Platform + Software Version + Software Image File */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Platform */}
          <div className="space-y-1">
            <Label htmlFor="platform" className="text-xs font-medium">
              Platform
            </Label>
            <Select
              value={watch('platform') ?? ''}
              onValueChange={(value) => {
                setValue('platform', value)
                // Reset dependent fields when platform changes
                setValue('softwareVersion', '')
                setValue('softwareImageFile', '')
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="platform" className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
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

          {/* Software Version - filtered by selected platform */}
          <div className="space-y-1">
            <Label htmlFor="softwareVersion" className="text-xs font-medium">
              Software Version
              {isLoadingSoftwareVersions && (
                <Loader2 className="inline ml-1 h-3 w-3 animate-spin" />
              )}
            </Label>
            <Select
              value={watch('softwareVersion') ?? ''}
              onValueChange={(value) => {
                setValue('softwareVersion', value)
                // Reset image file when version changes
                setValue('softwareImageFile', '')
              }}
              disabled={isLoading || isLoadingSoftwareVersions}
            >
              <SelectTrigger id="softwareVersion" className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                <SelectValue placeholder="Select version..." />
              </SelectTrigger>
              <SelectContent>
                {softwareVersions.map((sv) => (
                  <SelectItem key={sv.id} value={sv.id}>
                    {sv.platform?.name ? `${sv.platform.name} ${sv.version}` : sv.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Software Image File - filtered by selected software version */}
          <div className="space-y-1">
            <Label htmlFor="softwareImageFile" className="text-xs font-medium">
              Software Image File
              {isLoadingSoftwareImageFiles && (
                <Loader2 className="inline ml-1 h-3 w-3 animate-spin" />
              )}
            </Label>
            <Select
              value={watch('softwareImageFile') ?? ''}
              onValueChange={(value) => setValue('softwareImageFile', value)}
              disabled={isLoading || isLoadingSoftwareImageFiles}
            >
              <SelectTrigger id="softwareImageFile" className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                <SelectValue placeholder="Select image file..." />
              </SelectTrigger>
              <SelectContent>
                {softwareImageFiles.map((img) => (
                  <SelectItem key={img.id} value={img.id}>
                    {img.image_file_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
