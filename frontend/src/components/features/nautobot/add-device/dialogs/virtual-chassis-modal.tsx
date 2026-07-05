import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Layers, Loader2, Check, Plus } from 'lucide-react'
import type { VirtualChassisItem } from '../types'
import type { VirtualChassisMode } from '../hooks/use-virtual-chassis-manager'

interface VirtualChassisModalProps {
  show: boolean
  onClose: () => void
  items: VirtualChassisItem[]
  isLoading: boolean
  selectedVcId: string
  newVcName: string
  mode: VirtualChassisMode
  onSelect: (id: string, name: string) => void
  onNewVcNameChange: (name: string) => void
  onClear: () => void
}

export function VirtualChassisModal({
  show,
  onClose,
  items,
  isLoading,
  selectedVcId,
  newVcName,
  mode,
  onSelect,
  onNewVcNameChange,
  onClear,
}: VirtualChassisModalProps) {
  const [filter, setFilter] = useState('')

  const filteredItems = items.filter(vc =>
    vc.name.toLowerCase().includes(filter.toLowerCase())
  )

  const handleSelect = (vc: VirtualChassisItem) => {
    onSelect(vc.id, vc.name)
  }

  const handleNewVcNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onNewVcNameChange(e.target.value)
  }

  const selectPanelDimmed = mode === 'create' && newVcName.trim() !== ''
  const createPanelDimmed = mode === 'select' && selectedVcId !== ''

  return (
    <Dialog open={show} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Virtual Chassis (Stack)
          </DialogTitle>
          <DialogDescription>
            Select an existing stack to join, or create a new one. The new device will
            become master of any newly created stack.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Panel 1: Select existing stack */}
          <div
            className={`shadow-lg border-0 p-0 bg-card rounded-lg transition-opacity ${
              selectPanelDimmed ? 'opacity-50' : 'opacity-100'
            }`}
          >
            <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center space-x-2">
                <Layers className="h-4 w-4" />
                <span className="text-sm font-medium">Select Existing Stack</span>
              </div>
              {selectedVcId && (
                <div className="text-xs text-panel-header-muted">
                  Selected:{' '}
                  <span className="font-medium">
                    {items.find(v => v.id === selectedVcId)?.name ?? selectedVcId}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 panel-content">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    placeholder="Filter virtual chassis..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="border-2 border-border bg-card focus:border-primary focus:ring-2 focus:ring-ring/30 shadow-sm"
                  />

                  {filteredItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {filter
                        ? 'No matching virtual chassis found.'
                        : 'No virtual chassis configured in Nautobot.'}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border-2 border-border rounded-md">
                      {filteredItems.map(vc => (
                        <button
                          key={vc.id}
                          type="button"
                          onClick={() => handleSelect(vc)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-info transition-colors border-b border-border last:border-b-0 ${
                            selectedVcId === vc.id
                              ? 'bg-info text-info-foreground font-medium'
                              : ''
                          }`}
                        >
                          <span>{vc.name}</span>
                          {selectedVcId === vc.id && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedVcId && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-info px-3 py-2 rounded-md">
                      <span>
                        Selected:{' '}
                        <span className="font-medium text-info-foreground">
                          {items.find(v => v.id === selectedVcId)?.name ?? selectedVcId}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={onClear}
                        className="text-primary hover:text-primary/80 underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Panel 2: Create new stack */}
          <div
            className={`shadow-lg border-0 p-0 bg-card rounded-lg transition-opacity ${
              createPanelDimmed ? 'opacity-50' : 'opacity-100'
            }`}
          >
            <div className="bg-success text-success-foreground py-2 px-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Add Device to New Stack</span>
              </div>
              <div className="text-xs text-success-foreground/80">
                Device becomes master at position 1
              </div>
            </div>

            <div className="p-4 panel-content space-y-2">
              <Label htmlFor="new-vc-name" className="text-sm">
                New Stack Name
              </Label>
              <Input
                id="new-vc-name"
                placeholder="Enter a name for the new stack..."
                value={newVcName}
                onChange={handleNewVcNameChange}
                className="border-2 border-border bg-card focus:border-primary focus:ring-2 focus:ring-ring/30 shadow-sm"
              />
              {newVcName.trim() && (
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-success px-3 py-2 rounded-md">
                  <span>
                    New stack:{' '}
                    <span className="font-medium text-success-foreground">
                      {newVcName.trim()}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={onClear}
                    className="text-primary hover:text-primary/80 underline"
                  >
                    Clear
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                A new Virtual Chassis will be created in Nautobot. The new device will
                be assigned as master at position 1.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClear}>
            Clear All
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
