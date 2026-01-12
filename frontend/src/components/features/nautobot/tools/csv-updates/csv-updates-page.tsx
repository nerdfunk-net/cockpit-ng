'use client'

import { useState, useCallback, useMemo } from 'react'
import { FileSpreadsheet, Upload, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
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
import { PropertiesPanel } from './components'

const EMPTY_SET = new Set<string>()

export default function CsvUpdatesPage() {
  const [objectType, setObjectType] = useState<ObjectType>('devices')
  const [ignoreUuid, setIgnoreUuid] = useState(true) // Default: ignore UUID
  const [ignoredColumns, setIgnoredColumns] = useState<Set<string>>(EMPTY_SET)

  // Custom hook for CSV upload management
  const csvUpload = useCsvUpload({
    objectType,
    onParseComplete: () => {
      // CSV parsed successfully
    },
    onParseError: (error) => {
      console.error('CSV parse error:', error)
    },
  })

  // TanStack Query mutation for processing updates
  const { processUpdates } = useCsvUpdatesMutations()

  const handleObjectTypeChange = useCallback(
    (value: ObjectType) => {
      setObjectType(value)
      // Reset properties when changing object type
      setIgnoredColumns(EMPTY_SET)
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

  // Show properties panel for certain object types after successful parsing
  const showPropertiesPanel = useMemo(
    () =>
      csvUpload.parsedData.headers.length > 0 &&
      !csvUpload.validationSummary.hasErrors &&
      (objectType === 'ip-prefixes'),
    [csvUpload.parsedData.headers, csvUpload.validationSummary.hasErrors, objectType]
  )

  const handleProcessUpdates = useCallback(() => {
    if (!csvUpload.parsedData || csvUpload.validationSummary.hasErrors) {
      return
    }

    // Filter out ignored columns
    const headers = csvUpload.parsedData.headers
    const filteredHeaders: string[] = []
    const headerIndexMap: number[] = []

    headers.forEach((header, index) => {
      if (!ignoredColumns.has(header)) {
        filteredHeaders.push(header)
        headerIndexMap.push(index)
      }
    })

    // Filter rows to only include non-ignored columns
    const filteredRows = csvUpload.parsedData.rows.map((row) =>
      headerIndexMap.map((index) => row[index] || '')
    )

    processUpdates.mutate({
      objectType,
      csvData: {
        headers: filteredHeaders,
        rows: filteredRows,
      },
      csvOptions: {
        delimiter: csvUpload.csvConfig.delimiter,
        quoteChar: csvUpload.csvConfig.quoteChar,
      },
      dryRun: false,
      ignoreUuid, // Pass the ignoreUuid option
    })
  }, [objectType, csvUpload.parsedData, csvUpload.csvConfig, csvUpload.validationSummary, ignoredColumns, ignoreUuid, processUpdates])

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
            onClick={handleProcessUpdates}
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
