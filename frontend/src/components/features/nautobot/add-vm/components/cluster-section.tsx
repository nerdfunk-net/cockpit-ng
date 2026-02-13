import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { VMFormReturn } from '../hooks/use-vm-form'
import type { VMDropdownsResponse } from '../types'

interface ClusterSectionProps {
  form: VMFormReturn
  dropdownData: VMDropdownsResponse
  isLoading: boolean
}

export function ClusterSection({ form, dropdownData, isLoading }: ClusterSectionProps) {
  const {
    setValue,
    watch,
    formState: { errors },
  } = form

  const selectedClusterGroup = watch('clusterGroup')

  // Filter clusters by selected cluster group
  const filteredClusters = useMemo(() => {
    if (!selectedClusterGroup || selectedClusterGroup === 'all') return dropdownData.clusters
    return dropdownData.clusters.filter(
      (cluster) => cluster.cluster_group?.id === selectedClusterGroup
    )
  }, [dropdownData.clusters, selectedClusterGroup])

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center rounded-t-lg">
        <span className="text-sm font-medium">Cluster</span>
      </div>
      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cluster Group */}
          <div className="space-y-1">
            <Label htmlFor="clusterGroup" className="text-xs font-medium">
              Cluster Group
            </Label>
            <Select
              value={watch('clusterGroup') ?? 'all'}
              onValueChange={(value) => {
                setValue('clusterGroup', value === 'all' ? undefined : value)
                // Reset cluster when group changes
                setValue('cluster', '')
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="clusterGroup" className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                <SelectValue placeholder="All groups..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {dropdownData.clusterGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cluster */}
          <div className="space-y-1">
            <Label htmlFor="cluster" className="text-xs font-medium">
              Cluster <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch('cluster') ?? ''}
              onValueChange={(value) => setValue('cluster', value)}
              disabled={isLoading}
            >
              <SelectTrigger id="cluster" className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                <SelectValue placeholder="Select cluster..." />
              </SelectTrigger>
              <SelectContent>
                {filteredClusters.map((cluster) => (
                  <SelectItem key={cluster.id} value={cluster.id}>
                    {cluster.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.cluster && (
              <p className="text-xs text-destructive">{errors.cluster.message}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
