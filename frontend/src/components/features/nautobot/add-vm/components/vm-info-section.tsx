import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tags, FileText } from 'lucide-react'
import type { VMFormReturn } from '../hooks/use-vm-form'
import type { VMDropdownsResponse } from '../types'

interface VMInfoSectionProps {
  form: VMFormReturn
  dropdownData: VMDropdownsResponse
  isLoading: boolean
  onOpenTags: () => void
  onOpenCustomFields: () => void
  selectedTagsCount: number
}

export function VMInfoSection({
  form,
  dropdownData,
  isLoading,
  onOpenTags,
  onOpenCustomFields,
  selectedTagsCount,
}: VMInfoSectionProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <span className="text-sm font-medium">Virtual Machine</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-white hover:bg-white/20 hover:text-white"
            onClick={onOpenTags}
            disabled={isLoading}
          >
            <Tags className="h-3.5 w-3.5 mr-1.5" />
            Tags
            {selectedTagsCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs bg-white/20 text-white hover:bg-white/20">
                {selectedTagsCount}
              </Badge>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-white hover:bg-white/20 hover:text-white"
            onClick={onOpenCustomFields}
            disabled={isLoading}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Custom Fields
          </Button>
        </div>
      </div>
      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs font-medium">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              disabled={isLoading}
              className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1">
            <Label htmlFor="role" className="text-xs font-medium">
              Role
            </Label>
            <Select
              value={watch('role') ?? ''}
              onValueChange={(value) => setValue('role', value)}
              disabled={isLoading}
            >
              <SelectTrigger id="role" className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
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
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label htmlFor="status" className="text-xs font-medium">
              Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch('status') ?? ''}
              onValueChange={(value) => setValue('status', value)}
              disabled={isLoading}
            >
              <SelectTrigger id="status" className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
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
            {errors.status && (
              <p className="text-xs text-destructive">{errors.status.message}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
