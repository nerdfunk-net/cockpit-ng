'use client'

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CSV_IMPORT_NAUTOBOT_FIELDS } from "../../utils/constants"

const NOT_USED = "__not_used__"

interface CsvImportMappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  csvHeaders: string[]
  importType: string
  columnMapping: Record<string, string | null>
  onMappingChange: (mapping: Record<string, string | null>) => void
}

export function CsvImportMappingDialog({
  open,
  onOpenChange,
  csvHeaders,
  importType,
  columnMapping,
  onMappingChange,
}: CsvImportMappingDialogProps) {
  const [localMapping, setLocalMapping] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (open) {
      setLocalMapping({ ...columnMapping })
    }
  }, [open, columnMapping])

  const nbFields = CSV_IMPORT_NAUTOBOT_FIELDS[importType] || []

  const handleFieldChange = (csvCol: string, value: string) => {
    setLocalMapping((prev) => ({
      ...prev,
      [csvCol]: value === NOT_USED ? null : value,
    }))
  }

  const handleApply = () => {
    onMappingChange(localMapping)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Column Mapping</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600">
          Map each CSV column to a Nautobot field. Select &quot;Not Used&quot; to skip a column.
        </p>

        {csvHeaders.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No CSV headers available. Select a file first.
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-gray-600 font-medium w-1/2">CSV Column</th>
                  <th className="text-left py-2 px-2 text-gray-600 font-medium w-1/2">Nautobot Field</th>
                </tr>
              </thead>
              <tbody>
                {csvHeaders.filter((h) => h.trim() !== "").map((header) => {
                  const mapped = localMapping[header]
                  // Ensure selectValue is never an empty string (Radix constraint)
                  const selectValue = mapped === null ? NOT_USED : (mapped && mapped.trim() !== "" ? mapped : header)
                  return (
                    <tr key={header} className="border-b last:border-0">
                      <td className="py-2 px-2">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {header}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        <Select
                          value={selectValue}
                          onValueChange={(val) => handleFieldChange(header, val)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NOT_USED} className="text-gray-400 italic">
                              Not Used
                            </SelectItem>
                            {/* Include the original header name as auto-detect option */}
                            <SelectItem value={header}>
                              {header} (auto)
                            </SelectItem>
                            {/* Nautobot fields for this import type */}
                            {nbFields
                              .filter((f) => f !== header && f.trim() !== "")
                              .map((field) => (
                                <SelectItem key={field} value={field}>
                                  {field}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
