'use client'

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import type { GitRepository } from "../../types"
import { CSV_EXPORT_PROPERTIES } from "../../utils/constants"

interface CsvExportJobTemplateProps {
  formCsvExportRepoId: number | null
  setFormCsvExportRepoId: (value: number | null) => void
  formCsvExportFilePath: string
  setFormCsvExportFilePath: (value: string) => void
  formCsvExportProperties: string[]
  setFormCsvExportProperties: (value: string[]) => void
  formCsvExportDelimiter: string
  setFormCsvExportDelimiter: (value: string) => void
  formCsvExportQuoteChar: string
  setFormCsvExportQuoteChar: (value: string) => void
  formCsvExportIncludeHeaders: boolean
  setFormCsvExportIncludeHeaders: (value: boolean) => void
  csvExportRepos: GitRepository[]
}

export function CsvExportJobTemplate({
  formCsvExportRepoId,
  setFormCsvExportRepoId,
  formCsvExportFilePath,
  setFormCsvExportFilePath,
  formCsvExportProperties,
  setFormCsvExportProperties,
  formCsvExportDelimiter,
  setFormCsvExportDelimiter,
  formCsvExportQuoteChar,
  setFormCsvExportQuoteChar,
  formCsvExportIncludeHeaders,
  setFormCsvExportIncludeHeaders,
  csvExportRepos,
}: CsvExportJobTemplateProps) {
  const [configOpen, setConfigOpen] = useState(true)

  const toggleProperty = (id: string) => {
    if (formCsvExportProperties.includes(id)) {
      setFormCsvExportProperties(formCsvExportProperties.filter((p) => p !== id))
    } else {
      setFormCsvExportProperties([...formCsvExportProperties, id])
    }
  }

  return (
    <div className="space-y-4">
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <CollapsibleTrigger asChild>
            <div className="bg-gradient-to-r from-emerald-500/80 to-emerald-600/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg cursor-pointer select-none">
              <div className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span className="text-sm font-medium">CSV Export Configuration</span>
              </div>
              {configOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">

              {/* Git Repository */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Git Repository</Label>
                <Select
                  value={formCsvExportRepoId?.toString() || ""}
                  onValueChange={(val) => setFormCsvExportRepoId(val ? parseInt(val) : null)}
                >
                  <SelectTrigger className="h-8 text-sm bg-white border-gray-300 shadow-sm">
                    <SelectValue placeholder="Select a CSV exports repository..." />
                  </SelectTrigger>
                  <SelectContent>
                    {csvExportRepos.map((repo) => (
                      <SelectItem key={repo.id} value={repo.id.toString()}>
                        {repo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {csvExportRepos.length === 0 && (
                  <p className="text-xs text-gray-500">
                    No repositories with category &quot;csv_exports&quot; found. Add one in Settings → Git.
                  </p>
                )}
              </div>

              {/* File Path */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Output File Path</Label>
                <Input
                  className="h-8 text-sm bg-white border-gray-300 shadow-sm"
                  value={formCsvExportFilePath}
                  onChange={(e) => setFormCsvExportFilePath(e.target.value)}
                  placeholder="e.g. exports/devices.csv"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500">
                  Path within the repository where the CSV will be written and committed.
                </p>
              </div>

              {/* Properties */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">
                  Properties to Export
                  {formCsvExportProperties.length > 0 && (
                    <span className="ml-2 text-emerald-600 font-normal">
                      ({formCsvExportProperties.length} selected)
                    </span>
                  )}
                </Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3 bg-white">
                  {CSV_EXPORT_PROPERTIES.map((prop) => (
                    <div key={prop.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={`prop-${prop.id}`}
                        checked={formCsvExportProperties.includes(prop.id)}
                        onCheckedChange={() => toggleProperty(prop.id)}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor={`prop-${prop.id}`}
                          className="text-xs font-medium text-gray-700 cursor-pointer leading-tight"
                        >
                          {prop.label}
                        </label>
                        <p className="text-xs text-gray-400 leading-tight">{prop.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {formCsvExportProperties.length === 0 && (
                  <p className="text-xs text-red-500">At least one property must be selected.</p>
                )}
              </div>

              {/* Delimiter & Quote Char */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Delimiter</Label>
                  <Input
                    className="h-8 text-sm bg-white border-gray-300 shadow-sm"
                    value={formCsvExportDelimiter}
                    onChange={(e) => setFormCsvExportDelimiter(e.target.value)}
                    placeholder=","
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Quote Character</Label>
                  <Input
                    className="h-8 text-sm bg-white border-gray-300 shadow-sm"
                    value={formCsvExportQuoteChar}
                    onChange={(e) => setFormCsvExportQuoteChar(e.target.value)}
                    placeholder={'"'}
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Include Headers */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Include Headers</Label>
                  <p className="text-xs text-gray-500">Write column names as the first row of the CSV</p>
                </div>
                <Switch
                  checked={formCsvExportIncludeHeaders}
                  onCheckedChange={setFormCsvExportIncludeHeaders}
                />
              </div>

            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
}
