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
import { HardDrive, Globe, FileText, Loader2, Lock, Folder } from 'lucide-react'
import { useInventoryGroups } from '../hooks/use-template-queries'

interface SavedInventory {
  id: number
  name: string
  description?: string
  scope: string
  created_by: string
  group_path?: string | null
}

interface JobTemplateInventorySectionProps {
  formInventorySource: 'all' | 'inventory'
  setFormInventorySource: (value: 'all' | 'inventory') => void
  formInventoryName: string
  setFormInventoryName: (value: string) => void
  savedInventories: SavedInventory[]
  loadingInventories: boolean
  /** When true, hides the source selector and locks the section to inventory-only mode */
  inventoryRequired?: boolean
}

const EMPTY_GROUPS: string[] = []

export function JobTemplateInventorySection({
  formInventorySource,
  setFormInventorySource,
  formInventoryName,
  setFormInventoryName,
  savedInventories,
  loadingInventories,
  inventoryRequired = false,
}: JobTemplateInventorySectionProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const { data: groups = EMPTY_GROUPS } = useInventoryGroups()

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

  const handleSourceChange = (value: 'all' | 'inventory') => {
    setFormInventorySource(value)
    if (value === 'all') {
      setSelectedGroup('all')
    }
  }

  return (
    <div className="rounded-lg border border-success-border bg-success/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-success-foreground" />
        <Label className="text-sm font-semibold text-success-foreground">Inventory</Label>
        {inventoryRequired && (
          <Badge
            variant="secondary"
            className="text-xs bg-success text-success-foreground"
          >
            Required
          </Badge>
        )}
      </div>

      {inventoryRequired ? (
        <div className="space-y-1.5">
          <Label htmlFor="inventory-name-required" className="text-xs text-success-foreground">
            Saved Inventory <span className="text-destructive">*</span>
          </Label>
          {loadingInventories ? (
            <div className="flex items-center justify-center h-9 bg-card border border-success-border rounded-md">
              <Loader2 className="h-4 w-4 animate-spin text-success-foreground" />
            </div>
          ) : (
            <Select value={formInventoryName} onValueChange={setFormInventoryName}>
              <SelectTrigger
                id="inventory-name-required"
                className="h-9 bg-card border-success-border"
              >
                <SelectValue placeholder="Select inventory" />
              </SelectTrigger>
              <SelectContent>
                {savedInventories.map(inv => (
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
          {savedInventories.length === 0 && !loadingInventories && (
            <p className="text-xs text-success-foreground">
              No saved inventories found. Create one in{' '}
              <strong>Network → Automation → Inventory</strong> or{' '}
              <strong>Netmiko</strong>.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inventory-source" className="text-xs text-success-foreground">
                Source
              </Label>
              <Select
                value={formInventorySource}
                onValueChange={v => handleSourceChange(v as 'all' | 'inventory')}
              >
                <SelectTrigger
                  id="inventory-source"
                  className="h-9 bg-card border-success-border"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-info-foreground" />
                      <span>All Devices</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="inventory">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-success-foreground" />
                      <span>Use Saved Inventory</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inventory-group" className="text-xs text-success-foreground">
                Group
              </Label>
              <Select
                value={selectedGroup}
                onValueChange={value => {
                  setSelectedGroup(value)
                  setFormInventoryName('')
                }}
                disabled={formInventorySource === 'all'}
              >
                <SelectTrigger
                  id="inventory-group"
                  className="h-9 bg-card border-success-border disabled:opacity-50"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-success-foreground" />
                      <span>All</span>
                    </div>
                  </SelectItem>
                  {groups.map(group => (
                    <SelectItem key={group} value={group}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-success-foreground" />
                        <span>{group}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inventory-name" className="text-xs text-success-foreground">
                Saved Inventory{' '}
                {formInventorySource === 'inventory' && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              {loadingInventories ? (
                <div className="flex items-center justify-center h-9 bg-card border border-success-border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-success-foreground" />
                </div>
              ) : (
                <Select
                  value={formInventoryName}
                  onValueChange={setFormInventoryName}
                  disabled={formInventorySource === 'all'}
                >
                  <SelectTrigger
                    id="inventory-name"
                    className="h-9 bg-card border-success-border disabled:opacity-50"
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

          {formInventorySource === 'inventory' &&
            filteredInventories.length === 0 &&
            !loadingInventories && (
              <p className="text-xs text-success-foreground">
                {selectedGroup === 'all' ? (
                  <>
                    No saved inventories found. Create one in{' '}
                    <strong>Network → Automation → Inventory</strong> or{' '}
                    <strong>Netmiko</strong>.
                  </>
                ) : (
                  <>
                    No inventories found in group <strong>{selectedGroup}</strong>.
                    Select a different group or <strong>All</strong>.
                  </>
                )}
              </p>
            )}
        </>
      )}
    </div>
  )
}
