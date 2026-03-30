import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, Server } from 'lucide-react'
import type { RackItem, RackGroupItem } from '../types'

interface RackModalProps {
  show: boolean
  onClose: () => void
  availableRacks: RackItem[]
  availableRackGroups: RackGroupItem[]
  availablePositions: number[]
  selectedRackGroup: string
  onSelectRackGroup: (id: string) => void
  selectedRack: string
  onSelectRack: (id: string) => void
  selectedFace: string
  onSelectFace: (face: string) => void
  position: number | ''
  onSetPosition: (pos: number | '') => void
  isLoading: boolean
}

export function RackModal({
  show,
  onClose,
  availableRacks,
  availableRackGroups,
  availablePositions,
  selectedRackGroup,
  onSelectRackGroup,
  selectedRack,
  onSelectRack,
  selectedFace,
  onSelectFace,
  position,
  onSetPosition,
  isLoading,
}: RackModalProps) {
  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Rack Placement
          </DialogTitle>
          <DialogDescription>
            Configure rack placement for this device. All fields are optional.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Rack Group */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Rack Group</Label>
                <Select value={selectedRackGroup} onValueChange={onSelectRackGroup}>
                  <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                    <SelectValue placeholder="Any rack group..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any rack group</SelectItem>
                    {availableRackGroups.map((rg) => (
                      <SelectItem key={rg.id} value={rg.id}>
                        {rg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rack */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Rack</Label>
                <Select value={selectedRack} onValueChange={onSelectRack}>
                  <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                    <SelectValue placeholder="Select rack..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No rack</SelectItem>
                    {availableRacks.map((rack) => (
                      <SelectItem key={rack.id} value={rack.id}>
                        {rack.name} ({rack.u_height}U)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rack Face */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Rack Face</Label>
                <Select value={selectedFace} onValueChange={onSelectFace}>
                  <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                    <SelectValue placeholder="Select face..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="front">Front</SelectItem>
                    <SelectItem value="rear">Rear</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Position */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Position (U)</Label>
                {!selectedRack ? (
                  <p className="text-xs text-muted-foreground italic py-2 px-3 border-2 border-slate-200 rounded-md bg-slate-50">
                    Please select a rack first
                  </p>
                ) : (
                  <Select
                    value={position === '' ? '' : String(position)}
                    onValueChange={(val) => onSetPosition(val === '' ? '' : Number(val))}
                  >
                    <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                      <SelectValue placeholder="Select position..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No position</SelectItem>
                      {availablePositions.map((pos) => (
                        <SelectItem key={pos} value={String(pos)}>
                          U{pos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
