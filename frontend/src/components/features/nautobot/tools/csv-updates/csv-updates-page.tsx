
'use client'

import { useState, useCallback, useMemo } from 'react'
import { FileSpreadsheet, Upload, CheckCircle, AlertTriangle, Loader2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { ObjectType } from './types'
import { useCsvUpload } from './hooks/use-csv-upload'
import { useCsvUpdatesMutations } from '@/hooks/queries/use-csv-updates-mutations'
import { PropertiesPanel, MappingPanel } from './components'
import { useToast } from '@/hooks/use-toast'

const EMPTY_SET = new Set<string>()
const EMPTY_MAPPING: Record<string, string> = {}

export default function CsvUpdatesPage() {
  const [objectType, setObjectType] = useState<ObjectType>('devices')
  const [ignoreUuid, setIgnoreUuid] = useState(true) // Default: ignore UUID
  const [ignoredColumns, setIgnoredColumns] = useState<Set<string>>(EMPTY_SET)
  const [tagsMode, setTagsMode] = useState<'replace' | 'merge'>('replace') // Default: replace tags
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(EMPTY_MAPPING)

  // Auto-populate column mapping based on CSV headers
  const autoPopulateColumnMapping = useCallback((headers: string[]) => {
    if (objectType !== 'ip-prefixes') return

    const newMapping: Record<string, string> = {}

    // Map 'prefix' lookup field
    if (headers.includes('prefix')) {
      newMapping['prefix'] = 'prefix'
    }

    // Map 'namespace' lookup field
    // Try 'namespace' first, then 'namespace__name' as fallback
    if (headers.includes('namespace')) {
      newMapping['namespace'] = 'namespace'
    } else if (headers.includes('namespace__name')) {
      // Map namespace__name column to namespace lookup field
      newMapping['namespace'] = 'namespace__name'
    }

    setColumnMapping(newMapping)
  }, [objectType])

  // Custom hook for CSV upload management
  const csvUpload = useCsvUpload({
    objectType,
    onParseComplete: (data) => {
      // CSV parsed successfully - auto-populate column mapping
      // Use data.headers directly (not csvUpload.parsedData.headers which isn't updated yet)
      autoPopulateColumnMapping(data.headers)
    },
    onParseError: (error) => {
      console.error('CSV parse error:', error)
    },
  })

  // TanStack Query mutation for processing updates
  const { processUpdates } = useCsvUpdatesMutations()
  const { toast } = useToast()

  const handleObjectTypeChange = useCallback(
    (value: ObjectType) => {
      setObjectType(value)
      // Reset properties when changing object type
      setIgnoredColumns(EMPTY_SET)
      setColumnMapping(EMPTY_MAPPING)
      // Re-validate with new object type if data is already parsed
      csvUpload.revalidate(value)
    },
    [csvUpload]
  )

  // Check if CSV has ID column
  const hasIdColumn = useMemo(
    () => csvUpload.parsedData.headers.includes('id'),
    [csvUpload.parsedData.headers]
  )

  // Check if CSV has tags column
  const hasTagsColumn = useMemo(
    () => csvUpload.parsedData.headers.includes('tags'),
    [csvUpload.parsedData.headers]
  )

  // Show properties panel for certain object types after successful parsing
  const showPropertiesPanel = useMemo(
    () =>
      csvUpload.parsedData.headers.length > 0 &&
      !csvUpload.validationSummary.hasErrors &&
      (objectType === 'ip-prefixes'),
    [csvUpload.parsedData.headers, csvUpload.validationSummary.hasErrors, objectType]
  )

  // Show mapping panel for IP prefixes after successful parsing
  const showMappingPanel = useMemo(
    () =>
      csvUpload.parsedData.headers.length > 0 &&
      !csvUpload.validationSummary.hasErrors &&
      (objectType === 'ip-prefixes'),
    [csvUpload.parsedData.headers, csvUpload.validationSummary.hasErrors, objectType]
  )

  // Validate column mapping - check if all required fields are mapped
  const validateColumnMapping = useCallback((): boolean => {
    if (objectType !== 'ip-prefixes') return true

    const requiredFields = ['prefix', 'namespace']
    const missingFields = requiredFields.filter((field) => !columnMapping[field])

    return missingFields.length === 0
  }, [objectType, columnMapping])

  const handleProcessUpdates = useCallback((dryRun: boolean = false) => {
    if (!csvUpload.parsedData || csvUpload.validationSummary.hasErrors) {
      return
    }

    // Validate column mapping for IP prefixes
    if (!validateColumnMapping()) {
      toast({
        title: 'Mapping Error',
        description: 'Please map all required lookup fields before processing updates.',
        variant: 'destructive',
      })
      return
    }

    // Define columns that should NEVER be used for updates (read-only or identifiers)
    const ALWAYS_IGNORED_COLUMNS: Record<ObjectType, string[]> = {
      'ip-prefixes': [
        'display',
        'id',
        'object_type',
        'natural_slug',
        'ip_version',
        'date_allocated',
        'parent__namespace__name',
        'parent__network',
        'parent__prefix_length',
        'created',
        'last_updated',
        'url',
        'network',
        'broadcast',
        'prefix_length',
      ],
      'devices': ['display', 'id', 'object_type', 'natural_slug', 'created', 'last_updated', 'url'],
      'ip-addresses': ['display', 'id', 'object_type', 'natural_slug', 'ip_version', 'created', 'last_updated', 'url'],
      'locations': ['display', 'id', 'object_type', 'natural_slug', 'created', 'last_updated', 'url'],
    }

    // Define lookup columns (used for identifying objects, should not be updated)
    const LOOKUP_COLUMNS: Record<ObjectType, string[]> = {
      'ip-prefixes': ['prefix', 'namespace__name', 'namespace'],
      'devices': ['name', 'ip_address'],
      'ip-addresses': ['address', 'parent__namespace__name'],
      'locations': ['name', 'parent__name'],
    }

    const alwaysIgnored = ALWAYS_IGNORED_COLUMNS[objectType] || []
    const lookupColumns = LOOKUP_COLUMNS[objectType] || []

    // Build two lists:
    // 1. csvHeaders/csvRows - Include lookup columns (needed to find objects) but exclude always-ignored and user-ignored
    // 2. selectedColumns - Only updateable columns (no lookup, no always-ignored, no user-ignored)
    const headers = csvUpload.parsedData.headers
    const csvHeaders: string[] = []
    const csvHeaderIndexMap: number[] = []
    const selectedColumns: string[] = []

    headers.forEach((header, index) => {
      const isUserIgnored = ignoredColumns.has(header)
      const isAlwaysIgnored = alwaysIgnored.includes(header)
      const isLookupColumn = lookupColumns.includes(header)

      // Include in CSV if not always-ignored and not user-ignored
      // (lookup columns MUST be in CSV for object identification)
      if (!isAlwaysIgnored && !isUserIgnored) {
        csvHeaders.push(header)
        csvHeaderIndexMap.push(index)
      }

      // Include in selectedColumns only if it's an updateable column
      // (exclude lookup columns, always-ignored, and user-ignored)
      if (!isUserIgnored && !isAlwaysIgnored && !isLookupColumn) {
        selectedColumns.push(header)
      }
    })

    // Filter rows to only include columns in csvHeaders
    const csvRows = csvUpload.parsedData.rows.map((row) =>
      csvHeaderIndexMap.map((index) => row[index] || '')
    )

    processUpdates.mutate({
      objectType,
      csvData: {
        headers: csvHeaders, // Include lookup columns for object identification
        rows: csvRows,
      },
      csvOptions: {
        delimiter: csvUpload.csvConfig.delimiter,
        quoteChar: csvUpload.csvConfig.quoteChar,
      },
      dryRun, // Pass the dryRun parameter
      ignoreUuid, // Pass the ignoreUuid option
      tagsMode, // Pass the tags mode (replace or merge)
      columnMapping: objectType === 'ip-prefixes' ? columnMapping : undefined, // Pass column mapping for IP prefixes
      selectedColumns, // Pass only the updateable columns (excludes lookup columns)
    })
  }, [objectType, csvUpload.parsedData, csvUpload.csvConfig, csvUpload.validationSummary, ignoredColumns, ignoreUuid, tagsMode, columnMapping, validateColumnMapping, processUpdates, toast])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CSV Updates</h1>
            <p className="text-gray-600 mt-1">Upload and update Nautobot objects via CSV</p>
          </div>
        </div>
      </div>

      {/* Configuration Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Upload Configuration</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
          {/* Object Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="object-type" className="text-xs font-medium">
              Object Type <span className="text-destructive">*</span>
            </Label>
            <Select value={objectType} onValueChange={handleObjectTypeChange}>
              <SelectTrigger id="object-type" className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="devices">Devices</SelectItem>
                <SelectItem value="ip-prefixes">IP Prefixes</SelectItem>
                <SelectItem value="ip-addresses">IP Addresses</SelectItem>
                <SelectItem value="locations">Locations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CSV Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="csv-delimiter" className="text-xs font-medium">
                CSV Delimiter <span className="text-destructive">*</span>
              </Label>
              <Input
                id="csv-delimiter"
                value={csvUpload.csvConfig.delimiter}
                onChange={(e) =>
                  csvUpload.updateConfig({ delimiter: e.target.value })
                }
                placeholder=","
                maxLength={1}
                className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv-quote" className="text-xs font-medium">
                CSV Quote Character <span className="text-destructive">*</span>
              </Label>
              <Input
                id="csv-quote"
                value={csvUpload.csvConfig.quoteChar}
                onChange={(e) =>
                  csvUpload.updateConfig({ quoteChar: e.target.value })
                }
                placeholder='"'
                maxLength={1}
                className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
              />
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file" className="text-xs font-medium">
              CSV File <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={csvUpload.handleFileChange}
                className="flex-1 border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
              />
              <Button
                onClick={csvUpload.handleParseCSV}
                disabled={!csvUpload.csvFile || csvUpload.isParsing}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {csvUpload.isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Parse CSV
                  </>
                )}
              </Button>
            </div>
            {csvUpload.csvFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {csvUpload.csvFile.name} ({(csvUpload.csvFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {csvUpload.validationResults.length > 0 && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Validation Results</span>
              {csvUpload.isValidating && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            </div>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4">
              {csvUpload.validationSummary.successCount > 0 && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {csvUpload.validationSummary.successCount} Success
                </Badge>
              )}
              {csvUpload.validationSummary.warningCount > 0 && (
                <Badge variant="default" className="bg-yellow-500">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {csvUpload.validationSummary.warningCount} Warning
                </Badge>
              )}
              {csvUpload.validationSummary.errorCount > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {csvUpload.validationSummary.errorCount} Error
                </Badge>
              )}
            </div>

            {/* Results List */}
            <div className="space-y-2">
              {csvUpload.validationResults.map((result) => (
                <Alert
                  key={`${result.type}-${result.rowNumber ?? 'general'}-${result.message}`}
                  className={
                    result.type === 'error'
                      ? 'border-red-500 bg-red-50'
                      : result.type === 'warning'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-green-500 bg-green-50'
                  }
                >
                  <AlertDescription className="flex items-start gap-2">
                    {result.type === 'error' && (
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    {result.type === 'warning' && (
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    )}
                    {result.type === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="text-sm">
                      {result.rowNumber && `Row ${result.rowNumber}: `}
                      {result.message}
                    </span>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mapping Panel - For IP prefixes */}
      {showMappingPanel && (
        <MappingPanel
          objectType={objectType}
          csvHeaders={csvUpload.parsedData.headers}
          columnMapping={columnMapping}
          onColumnMappingChange={setColumnMapping}
        />
      )}

      {/* Properties Panel - Conditional based on object type */}
      {showPropertiesPanel && (
        <PropertiesPanel
          objectType={objectType}
          headers={csvUpload.parsedData.headers}
          hasIdColumn={hasIdColumn}
          ignoreUuid={ignoreUuid}
          onIgnoreUuidChange={setIgnoreUuid}
          ignoredColumns={ignoredColumns}
          onIgnoredColumnsChange={setIgnoredColumns}
          hasTagsColumn={hasTagsColumn}
          tagsMode={tagsMode}
          onTagsModeChange={setTagsMode}
        />
      )}

      {/* Parsed Data Preview */}
      {csvUpload.parsedData.headers.length > 0 && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Data Preview</span>
            </div>
            <span className="text-xs text-white/80">
              Showing first 10 rows of {csvUpload.parsedData.rowCount} total
            </span>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {csvUpload.parsedData.headers.slice(0, 8).map((header) => (
                      <TableHead key={header} className="font-semibold">
                        {header}
                      </TableHead>
                    ))}
                    {csvUpload.parsedData.headers.length > 8 && (
                      <TableHead className="font-semibold">...</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvUpload.parsedData.rows.slice(0, 10).map((row) => (
                    <TableRow key={row.join('|')}>
                      {row.slice(0, 8).map((cell) => (
                        <TableCell key={`${row.join('|')}-${cell}`} className="max-w-xs truncate">
                          {cell || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      ))}
                      {row.length > 8 && (
                        <TableCell className="text-muted-foreground">...</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {csvUpload.parsedData.rowCount > 10 && (
              <p className="text-sm text-muted-foreground mt-4">
                ... and {csvUpload.parsedData.rowCount - 10} more rows
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {csvUpload.parsedData.headers.length > 0 && !csvUpload.validationSummary.hasErrors && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={csvUpload.clearData} className="border-2">
            Clear
          </Button>
          <Button
            variant="outline"
            onClick={() => handleProcessUpdates(true)}
            disabled={processUpdates.isPending}
            className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
          >
            {processUpdates.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Dry Run...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Dry Run
              </>
            )}
          </Button>
          <Button
            onClick={() => handleProcessUpdates(false)}
            disabled={processUpdates.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {processUpdates.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Process Updates
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
