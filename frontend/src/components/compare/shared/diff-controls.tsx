/**
 * Shared Diff Controls Component
 * Provides font size, hide unchanged, and export controls for diff views
 */

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Eye, EyeOff } from 'lucide-react'

interface DiffControlsProps {
  // Font size controls
  fontSize: number
  onFontSizeChange: (size: number) => void
  showFontSize?: boolean

  // Hide unchanged controls
  hideUnchanged: boolean
  onHideUnchangedToggle: () => void
  showHideUnchanged?: boolean

  // Export controls
  onExport?: () => void
  showExport?: boolean

  className?: string
}

export function DiffControls({
  fontSize,
  onFontSizeChange,
  showFontSize = true,
  hideUnchanged,
  onHideUnchangedToggle,
  showHideUnchanged = true,
  onExport,
  showExport = true,
  className = ''
}: DiffControlsProps) {
  // Memoize the font size change callback
  const handleFontSizeChange = useCallback((value: string) => {
    const size = parseInt(value)
    if (size >= 8 && size <= 20) {
      onFontSizeChange(size)
    }
  }, [onFontSizeChange])

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Font Size Control */}
      {showFontSize && (
        <div className="flex items-center gap-2">
          <Label className="text-sm">Font Size:</Label>
          <Select
            value={fontSize.toString()}
            onValueChange={handleFontSizeChange}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[8, 10, 12, 14, 16].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Hide Unchanged Toggle */}
      {showHideUnchanged && (
        <Button
          variant="outline"
          size="sm"
          onClick={onHideUnchangedToggle}
          className="flex items-center gap-2"
        >
          {hideUnchanged ? (
            <>
              <Eye className="h-4 w-4" />
              <span>Show Unchanged</span>
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4" />
              <span>Hide Unchanged</span>
            </>
          )}
        </Button>
      )}

      {/* Export Button */}
      {showExport && onExport && (
        <Button
          variant="outline"
          onClick={onExport}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          <span>Export Diff</span>
        </Button>
      )}
    </div>
  )
}
