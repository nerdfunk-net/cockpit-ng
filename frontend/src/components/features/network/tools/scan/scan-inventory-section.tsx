import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { HardDrive, Network, FileText, Loader2, Lock, Folder } from 'lucide-react'
import {
  useInventoryGroupsQuery,
  type SavedInventory,
} from '@/hooks/queries/use-saved-inventories-queries'

export type ScanTargetSource = 'cidr' | 'inventory'

interface ScanInventorySectionProps {
  targetSource: ScanTargetSource
  setTargetSource: (value: ScanTargetSource) => void
  inventoryName: string
  setInventoryName: (value: string) => void
  savedInventories: SavedInventory[]
  loadingInventories: boolean
}

const EMPTY_GROUPS: string[] = []

export function ScanInventorySection({
  targetSource,
  setTargetSource,
  inventoryName,
  setInventoryName,
  savedInventories,
  loadingInventories,
}: ScanInventorySectionProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const { data: groups = EMPTY_GROUPS } = useInventoryGroupsQuery()

  const filteredInventories = useMemo(() => {
    if (selectedGroup === 'all') return savedInventories
    return savedInventories.filter(inv => {
      if (!inv.group_path) return false
      return (
        inv.group_path === selectedGroup ||
        inv.group_path.startsWith(selectedGroup + '/')
      )
    })
  }, [savedInventories, selectedGroup])

  const handleSourceChange = (value: ScanTargetSource) => {
    setTargetSource(value)
    if (value === 'cidr') {
      setSelectedGroup('all')
      setInventoryName('')
    }
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-emerald-600" />
        <Label className="text-sm font-semibold text-emerald-900">Scan Targets</Label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="scan-target-source" className="text-xs text-emerald-700">
            Source
          </Label>
          <Select
            value={targetSource}
            onValueChange={v => handleSourceChange(v as ScanTargetSource)}
          >
            <SelectTrigger
              id="scan-target-source"
              className="h-9 bg-white border-emerald-200"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cidr">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-blue-500" />
                  <span>CIDR Prefixes</span>
                </div>
              </SelectItem>
              <SelectItem value="inventory">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  <span>Use Saved Inventory</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="scan-inventory-group" className="text-xs text-emerald-700">
            Group
          </Label>
          <Select
            value={selectedGroup}
            onValueChange={value => {
              setSelectedGroup(value)
              setInventoryName('')
            }}
            disabled={targetSource === 'cidr'}
          >
            <SelectTrigger
              id="scan-inventory-group"
              className="h-9 bg-white border-emerald-200 disabled:opacity-50"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-emerald-500" />
                  <span>All</span>
                </div>
              </SelectItem>
              {groups.map(group => (
                <SelectItem key={group} value={group}>
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-emerald-400" />
                    <span>{group}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="scan-inventory-name" className="text-xs text-emerald-700">
            Saved Inventory{' '}
            {targetSource === 'inventory' && <span className="text-red-500">*</span>}
          </Label>
          {loadingInventories ? (
            <div className="flex items-center justify-center h-9 bg-white border border-emerald-200 rounded-md">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            </div>
          ) : (
            <Select
              value={inventoryName}
              onValueChange={setInventoryName}
              disabled={targetSource === 'cidr'}
            >
              <SelectTrigger
                id="scan-inventory-name"
                className="h-9 bg-white border-emerald-200 disabled:opacity-50"
              >
                <SelectValue placeholder="Select inventory" />
              </SelectTrigger>
              <SelectContent>
                {filteredInventories.map(inv => (
                  <SelectItem key={inv.id} value={inv.name}>
                    <div className="flex items-center gap-2">
                      <span>{inv.name}</span>
                      {inv.scope === 'private' && (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Private
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {targetSource === 'inventory' &&
        filteredInventories.length === 0 &&
        !loadingInventories && (
          <p className="text-xs text-emerald-600">
            {selectedGroup === 'all' ? (
              <>
                No saved inventories found. Create one in{' '}
                <strong>Network → Automation → Inventory</strong> or{' '}
                <strong>Netmiko</strong>.
              </>
            ) : (
              <>
                No inventories found in group <strong>{selectedGroup}</strong>. Select a
                different group or <strong>All</strong>.
              </>
            )}
          </p>
        )}
    </div>
  )
}
