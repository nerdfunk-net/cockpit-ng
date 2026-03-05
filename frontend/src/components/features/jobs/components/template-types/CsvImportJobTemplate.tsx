'use client'

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Filter, Loader2, Settings2, Upload } from "lucide-react"
import type { CsvRepoFile, GitRepository } from "../../templates/types"
import { CSV_IMPORT_TYPE_LABELS } from "../../templates/utils/constants"

interface CsvImportJobTemplateProps {
  formCsvImportRepoId: number | null
  setFormCsvImportRepoId: (value: number | null) => void
  formCsvImportFilePath: string
  setFormCsvImportFilePath: (value: string) => void
  formCsvImportType: string
  setFormCsvImportType: (value: string) => void
  formCsvImportPrimaryKey: string
  setFormCsvImportPrimaryKey: (value: string) => void
  formCsvImportUpdateExisting: boolean
  setFormCsvImportUpdateExisting: (value: boolean) => void
  formCsvImportDelimiter: string
  setFormCsvImportDelimiter: (value: string) => void
  formCsvImportQuoteChar: string
  setFormCsvImportQuoteChar: (value: string) => void
  formCsvImportColumnMapping: Record<string, string | null>
  formCsvImportFileFilter: string
  setFormCsvImportFileFilter: (value: string) => void
  csvImportRepos: GitRepository[]
  csvFiles: CsvRepoFile[]
  csvHeaders: string[]
  csvFilesLoading: boolean
  csvHeadersLoading: boolean
  mappedColumnCount: number
  onOpenMappingDialog: () => void
  fileQuery: string
  setFileQuery: (value: string) => void
}

export function CsvImportJobTemplate({
  formCsvImportRepoId,
  setFormCsvImportRepoId,
  formCsvImportFilePath,
  setFormCsvImportFilePath,
  formCsvImportType,
  setFormCsvImportType,
  formCsvImportPrimaryKey,
  setFormCsvImportPrimaryKey,
  formCsvImportUpdateExisting,
  setFormCsvImportUpdateExisting,
  formCsvImportDelimiter,
  setFormCsvImportDelimiter,
  formCsvImportQuoteChar,
  setFormCsvImportQuoteChar,
  formCsvImportFileFilter,
  setFormCsvImportFileFilter,
  csvImportRepos,
  csvFiles,
  csvHeaders,
  csvFilesLoading,
  csvHeadersLoading,
  mappedColumnCount,
  onOpenMappingDialog,
  fileQuery,
  setFileQuery,
}: CsvImportJobTemplateProps) {
  return (
    <div className="space-y-4">
      {/* Panel 1: CSV Import Configuration */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span className="text-sm font-medium">CSV Import Configuration</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          {/* Info alert */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              The <strong>CSV File</strong> and file filter below are used only to load an
              example file for column mapping configuration. The actual files imported at
              runtime are determined by the <strong>Import Options</strong> file filter below.
            </AlertDescription>
          </Alert>

          {/* Git Repository */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Git Repository</Label>
            <Select
              value={formCsvImportRepoId?.toString() || ""}
              onValueChange={(val) => {
                setFormCsvImportRepoId(val ? parseInt(val) : null)
                setFormCsvImportFilePath("")
                setFormCsvImportPrimaryKey("")
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select a CSV imports repository..." />
              </SelectTrigger>
              <SelectContent>
                {csvImportRepos.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id.toString()}>
                    {repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {csvImportRepos.length === 0 && (
              <p className="text-xs text-gray-500">
                No repositories with category &quot;csv_imports&quot; found. Add one in Settings → Git.
              </p>
            )}
          </div>

          {/* File Selector */}
          {formCsvImportRepoId && (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">CSV File (example for mapping)</Label>
              <Input
                className="h-7 text-xs mb-1"
                placeholder="Filter files..."
                value={fileQuery}
                onChange={(e) => setFileQuery(e.target.value)}
              />
              <Select
                value={formCsvImportFilePath}
                onValueChange={(val) => {
                  setFormCsvImportFilePath(val)
                  setFormCsvImportPrimaryKey("")
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  {csvFilesLoading ? (
                    <span className="flex items-center gap-1 text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                    </span>
                  ) : (
                    <SelectValue placeholder="Select a CSV file..." />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {csvFiles.length === 0 && !csvFilesLoading && (
                    <SelectItem value="__none__" disabled>No CSV files found</SelectItem>
                  )}
                  {csvFiles.filter((f) => f.path.trim() !== "").map((file) => (
                    <SelectItem key={file.path} value={file.path}>
                      {file.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Import Type */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Import Type</Label>
            <Select
              value={formCsvImportType}
              onValueChange={(val) => {
                setFormCsvImportType(val)
                setFormCsvImportPrimaryKey("")
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select object type..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CSV_IMPORT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Primary Key */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">Primary Key Column</Label>
            <Select
              value={formCsvImportPrimaryKey}
              onValueChange={setFormCsvImportPrimaryKey}
              disabled={!formCsvImportFilePath || csvHeadersLoading || csvHeaders.length === 0}
            >
              <SelectTrigger className="h-8 text-sm">
                {csvHeadersLoading ? (
                  <span className="flex items-center gap-1 text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading headers...
                  </span>
                ) : (
                  <SelectValue placeholder={
                    !formCsvImportFilePath ? "Select a file first..." : "Select lookup column..."
                  } />
                )}
              </SelectTrigger>
              <SelectContent>
                {csvHeaders.filter((h) => h.trim() !== "").map((header) => (
                  <SelectItem key={header} value={header}>
                    <code className="text-xs">{header}</code>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Column used to look up existing objects in Nautobot (e.g. &quot;name&quot;, &quot;address&quot;)
            </p>
          </div>

          {/* Update Existing */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium text-gray-600">Update Existing Objects</Label>
              <p className="text-xs text-gray-500">When off, existing objects are skipped instead of updated</p>
            </div>
            <Switch
              checked={formCsvImportUpdateExisting}
              onCheckedChange={setFormCsvImportUpdateExisting}
            />
          </div>

          {/* Delimiter & Quote Char */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Delimiter</Label>
              <Input
                className="h-8 text-sm"
                value={formCsvImportDelimiter}
                onChange={(e) => setFormCsvImportDelimiter(e.target.value)}
                placeholder=","
                maxLength={10}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Quote Character</Label>
              <Input
                className="h-8 text-sm"
                value={formCsvImportQuoteChar}
                onChange={(e) => setFormCsvImportQuoteChar(e.target.value)}
                placeholder={'"'}
                maxLength={10}
              />
            </div>
          </div>

          {/* Column Mapping */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium text-gray-600">Column Mapping</Label>
              {mappedColumnCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {mappedColumnCount} columns mapped
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={csvHeaders.length === 0 || !formCsvImportType}
              onClick={onOpenMappingDialog}
            >
              <Settings2 className="h-3 w-3 mr-1" />
              Edit Mapping
            </Button>
          </div>
        </div>
      </div>

      {/* Panel 2: Import Options */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Import Options</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-600">File Filter</Label>
            <Input
              className="h-8 text-sm"
              value={formCsvImportFileFilter}
              onChange={(e) => setFormCsvImportFileFilter(e.target.value)}
              placeholder="e.g. *.csv or devices_*.csv"
            />
            <p className="text-xs text-gray-500">
              Glob pattern to select which CSV files are imported when the job runs.
              All matching files in the repository will be processed sequentially.
              Leave empty to import only the example file selected above.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
