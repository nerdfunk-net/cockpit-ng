import { RackElevation } from './rack-elevation'
import type { RackFaceAssignments, ActiveSlot, DeviceSearchResult } from '../types'

interface RackViewProps {
  uHeight: number
  frontAssignments: RackFaceAssignments
  rearAssignments: RackFaceAssignments
  onAdd: (position: number, face: 'front' | 'rear', device: DeviceSearchResult) => void
  onRemove: (position: number, face: 'front' | 'rear') => void
  deviceSearchQuery: string
  onDeviceSearchQueryChange: (q: string) => void
  deviceSearchResults: DeviceSearchResult[]
  isSearching: boolean
  activeSlot: ActiveSlot | null
  onSetActiveSlot: (slot: ActiveSlot | null) => void
}

export function RackView({
  uHeight,
  frontAssignments,
  rearAssignments,
  onAdd,
  onRemove,
  deviceSearchQuery,
  onDeviceSearchQueryChange,
  deviceSearchResults,
  isSearching,
  activeSlot,
  onSetActiveSlot,
}: RackViewProps) {
  return (
    <div className="flex gap-12 justify-center overflow-x-auto pb-4">
      {/* Front face */}
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Front
        </h3>
        <RackElevation
          face="front"
          uHeight={uHeight}
          assignments={frontAssignments}
          onAdd={(pos, device) => onAdd(pos, 'front', device)}
          onRemove={(pos) => onRemove(pos, 'front')}
          deviceSearchQuery={activeSlot?.face === 'front' ? deviceSearchQuery : ''}
          onDeviceSearchQueryChange={onDeviceSearchQueryChange}
          deviceSearchResults={activeSlot?.face === 'front' ? deviceSearchResults : []}
          isSearching={activeSlot?.face === 'front' ? isSearching : false}
          activeSlot={activeSlot}
          onSetActiveSlot={onSetActiveSlot}
        />
      </div>

      {/* Rear face */}
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Rear
        </h3>
        <RackElevation
          face="rear"
          uHeight={uHeight}
          assignments={rearAssignments}
          onAdd={(pos, device) => onAdd(pos, 'rear', device)}
          onRemove={(pos) => onRemove(pos, 'rear')}
          deviceSearchQuery={activeSlot?.face === 'rear' ? deviceSearchQuery : ''}
          onDeviceSearchQueryChange={onDeviceSearchQueryChange}
          deviceSearchResults={activeSlot?.face === 'rear' ? deviceSearchResults : []}
          isSearching={activeSlot?.face === 'rear' ? isSearching : false}
          activeSlot={activeSlot}
          onSetActiveSlot={onSetActiveSlot}
        />
      </div>
    </div>
  )
}
