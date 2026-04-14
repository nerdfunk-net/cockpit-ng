'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { queryKeys } from '@/lib/query-keys'
import { useRackMappingsQuery, type RackMapping } from '../hooks/use-rack-mappings-query'

const EMPTY_MAPPINGS: RackMapping[] = []

interface RackMappingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rackName: string
  locationId: string
}

export function RackMappingsDialog({
  open,
  onOpenChange,
  rackName,
  locationId,
}: RackMappingsDialogProps) {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isClearing, setIsClearing] = useState(false)

  const { data: mappings = EMPTY_MAPPINGS, isLoading } = useRackMappingsQuery({
    rack_name: rackName,
    location_id: locationId,
    enabled: open && Boolean(rackName) && Boolean(locationId),
  })

  const handleClear = async () => {
    setIsClearing(true)
    try {
      await apiCall(
        `nautobot/rack-mappings?rack_name=${encodeURIComponent(rackName)}&location_id=${encodeURIComponent(locationId)}`,
        { method: 'DELETE' }
      )
      queryClient.invalidateQueries({
        queryKey: queryKeys.nautobot.rackMappings({ rack_name: rackName, location_id: locationId }),
      })
      toast({ title: 'Mappings cleared', description: `All name mappings for ${rackName} have been removed.` })
    } catch (err) {
      toast({
        title: 'Failed to clear mappings',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Device Name Mappings — {rackName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          These mappings are applied automatically when &ldquo;Use Mapping from DB&rdquo; is enabled during import.
        </p>

        <div className="rounded-md border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : mappings.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No saved mappings for this rack.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">CSV Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Nautobot Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mappings.map(m => (
                  <tr key={m.origin_name}>
                    <td className="px-3 py-2 font-mono text-gray-700 truncate max-w-[180px]" title={m.origin_name}>
                      {m.origin_name}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700 truncate max-w-[180px]" title={m.mapped_name}>
                      {m.mapped_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClear}
            disabled={isClearing || mappings.length === 0}
            className="gap-1.5"
          >
            {isClearing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Clear Mappings
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
