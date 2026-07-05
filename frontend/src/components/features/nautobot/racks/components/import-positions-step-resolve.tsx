'use client'

import { MapPin } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const NOT_USED_SENTINEL = '--not-used--'

interface ImportPositionsStepResolveProps {
  headers: string[]
  locationColumn: string | null
  onLocationColumnChange: (col: string | null) => void
  previewMatchCount: number
  rackName: string
  locationName: string
  isResolving: boolean
}

export function ImportPositionsStepResolve({
  headers,
  locationColumn,
  onLocationColumnChange,
  previewMatchCount,
  rackName,
  locationName,
  isResolving,
}: ImportPositionsStepResolveProps) {
  return (
    <div className="space-y-6">
      {/* Rack Location Disambiguation */}
      <div className="rounded-lg border border-warning-border bg-warning p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-warning-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Rack Location Disambiguation
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Rack names must be unique within a location, but the same rack name can exist
          in multiple locations (e.g., both{' '}
          <span className="font-medium">Building A</span> and{' '}
          <span className="font-medium">Building B</span> may each have a rack named{' '}
          <span className="font-medium text-foreground">{rackName || 'A_1'}</span>).
          Select the CSV column that identifies the location so the correct rows can be
          filtered.
        </p>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Location column
          </span>
          <Select
            value={locationColumn ?? NOT_USED_SENTINEL}
            onValueChange={v =>
              onLocationColumnChange(v === NOT_USED_SENTINEL ? null : v)
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value={NOT_USED_SENTINEL}
                className="text-xs text-muted-foreground"
              >
                NOT USED
              </SelectItem>
              {headers.map(col => (
                <SelectItem key={col} value={col} className="text-xs">
                  {col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {locationColumn && (
          <p className="text-xs text-warning-foreground">
            Column <span className="font-medium">{locationColumn}</span> will be matched
            against location name <span className="font-medium">{locationName}</span>.
          </p>
        )}
      </div>

      {/* Match preview */}
      {rackName && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Row Preview</h3>
          {previewMatchCount > 0 ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-success text-success-foreground border-success-border">
                {previewMatchCount} {previewMatchCount === 1 ? 'row' : 'rows'} matched
              </Badge>
              <span className="text-xs text-muted-foreground">
                for rack <span className="font-medium text-foreground">{rackName}</span>
                {locationColumn && locationName && (
                  <>
                    {' '}
                    at <span className="font-medium text-foreground">{locationName}</span>
                  </>
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="destructive">0 rows matched</Badge>
              <span className="text-xs text-muted-foreground">
                No rows found for rack <span className="font-medium">{rackName}</span>.
                {!locationColumn && ' Try selecting a location column above.'}
                {locationColumn &&
                  ' Check that the rack name and location values match your CSV.'}
              </span>
            </div>
          )}
        </div>
      )}

      {isResolving && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Resolving device names in Nautobot…
        </div>
      )}
    </div>
  )
}
