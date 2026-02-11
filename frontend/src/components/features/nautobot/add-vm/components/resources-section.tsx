import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { VMFormReturn } from '../hooks/use-vm-form'

interface ResourcesSectionProps {
  form: VMFormReturn
  isLoading: boolean
}

export function ResourcesSection({ form, isLoading }: ResourcesSectionProps) {
  const { register } = form

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
        <span className="text-sm font-medium">Resources</span>
      </div>
      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* vCPUs */}
          <div className="space-y-1">
            <Label htmlFor="vcpus" className="text-xs font-medium">
              vCPUs
            </Label>
            <Input
              id="vcpus"
              type="number"
              min={1}
              placeholder="e.g. 4"
              {...register('vcpus')}
              disabled={isLoading}
              className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
          </div>

          {/* Memory */}
          <div className="space-y-1">
            <Label htmlFor="memory" className="text-xs font-medium">
              Memory (MB)
            </Label>
            <Input
              id="memory"
              type="number"
              min={1}
              placeholder="e.g. 4096"
              {...register('memory')}
              disabled={isLoading}
              className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
          </div>

          {/* Disk */}
          <div className="space-y-1">
            <Label htmlFor="disk" className="text-xs font-medium">
              Disk (GB)
            </Label>
            <Input
              id="disk"
              type="number"
              min={1}
              placeholder="e.g. 100"
              {...register('disk')}
              disabled={isLoading}
              className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
