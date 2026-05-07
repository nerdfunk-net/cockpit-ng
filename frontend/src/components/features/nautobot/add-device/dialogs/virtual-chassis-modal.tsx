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
import { Layers, Loader2, Check } from 'lucide-react'
import type { VirtualChassisItem } from '../types'

interface VirtualChassisModalProps {
  show: boolean
  onClose: () => void
  items: VirtualChassisItem[]
  isLoading: boolean
  selectedVcId: string
  onSelect: (id: string, name: string) => void
  onClear: () => void
}

export function VirtualChassisModal({
  show,
  onClose,
  items,
  isLoading,
  selectedVcId,
  onSelect,
  onClear,
}: VirtualChassisModalProps) {
  const [filter, setFilter] = useState('')

  const filteredItems = items.filter((vc) =>
    vc.name.toLowerCase().includes(filter.toLowerCase())
  )

  const handleSelect = (vc: VirtualChassisItem) => {
    onSelect(vc.id, vc.name)
    onClose()
  }

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Virtual Chassis (Stack)
          </DialogTitle>
          <DialogDescription>
            Select a virtual chassis to add this device to as a new member.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Input
                placeholder="Filter virtual chassis..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
              />

              {filteredItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {filter ? 'No matching virtual chassis found.' : 'No virtual chassis configured in Nautobot.'}
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto border-2 border-slate-200 rounded-md">
                  {filteredItems.map((vc) => (
                    <button
                      key={vc.id}
                      type="button"
                      onClick={() => handleSelect(vc)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                        selectedVcId === vc.id ? 'bg-blue-50 text-blue-700 font-medium' : ''
                      }`}
                    >
                      <span>{vc.name}</span>
                      {selectedVcId === vc.id && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {selectedVcId && (
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-blue-50 px-3 py-2 rounded-md">
                  <span>
                    Selected:{' '}
                    <span className="font-medium text-blue-700">
                      {items.find((v) => v.id === selectedVcId)?.name ?? selectedVcId}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={onClear}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
