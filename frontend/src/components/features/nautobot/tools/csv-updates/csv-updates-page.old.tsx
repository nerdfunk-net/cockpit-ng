'use client'

import { useState, useCallback, useMemo } from 'react'
import { FileSpreadsheet, Upload, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { ObjectType, CSVConfig, ParsedCSVData, ValidationResult } from './types'
import { parseCSVContent, validateCSVData } from './utils/csv-parser'
import { DEFAULT_CSV_CONFIG, EMPTY_PARSED_DATA, EMPTY_VALIDATION_RESULTS } from './constants'

export default function CsvUpdatesPage() {
  const [objectType, setObjectType] = useState<ObjectType>('devices')
  const [csvConfig, setCsvConfig] = useState<CSVConfig>(DEFAULT_CSV_CONFIG)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSVData>(EMPTY_PARSED_DATA)
  const [validationResults, setValidationResults] = useState<ValidationResult[]>(EMPTY_VALIDATION_RESULTS)
  const [isParsing, setIsParsing] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setCsvFile(file)
      setParsedData(EMPTY_PARSED_DATA)
      setValidationResults(EMPTY_VALIDATION_RESULTS)
    }
  }, [])

  const handleParseCSV = useCallback(async () => {
    if (!csvFile) return

    setIsParsing(true)
    setValidationResults(EMPTY_VALIDATION_RESULTS)

    try {
      const text = await csvFile.text()
      const { headers, rows } = parseCSVContent(text, csvConfig)

      setParsedData({
        headers,
        rows,
        rowCount: rows.length,
      })

      // Start validation
      setIsValidating(true)
      const results = validateCSVData(objectType, headers, rows)
      setValidationResults(results)
      setIsValidating(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse CSV'
      setValidationResults([
        {
          type: 'error',
          message: errorMessage,
        },
      ])
      setIsValidating(false)
    } finally {
      setIsParsing(false)
    }
  }, [csvFile, csvConfig, objectType])


  const handleObjectTypeChange = useCallback((value: ObjectType) => {
    setObjectType(value)
    // Re-validate if data is already parsed
    if (parsedData.headers.length > 0) {
      setIsValidating(true)
      const results = validateCSVData(value, parsedData.headers, parsedData.rows)
      setValidationResults(results)
      setIsValidating(false)
    }
  }, [parsedData])

  const successCount = useMemo(
    () => validationResults.filter(r => r.type === 'success').length,
    [validationResults]
  )

  const warningCount = useMemo(
    () => validationResults.filter(r => r.type === 'warning').length,
    [validationResults]
  )

  const errorCount = useMemo(
    () => validationResults.filter(r => r.type === 'error').length,
    [validationResults]
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <FileSpreadsheet className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CSV Updates</h1>
            <p className="text-gray-600 mt-1">Upload and update Nautobot objects via CSV</p>
          </div>
        </div>
      </div>

      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Configuration</CardTitle>
          <CardDescription>
            Select the object type and configure CSV parsing options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Object Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="object-type">Object Type</Label>
            <Select value={objectType} onValueChange={handleObjectTypeChange}>
              <SelectTrigger id="object-type">
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
              <Label htmlFor="csv-delimiter">CSV Delimiter</Label>
              <Input
                id="csv-delimiter"
                value={csvConfig.delimiter}
                onChange={(e) =>
                  setCsvConfig(prev => ({ ...prev, delimiter: e.target.value }))
                }
                placeholder=","
                maxLength={1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="csv-quote">CSV Quote Character</Label>
              <Input
                id="csv-quote"
                value={csvConfig.quoteChar}
                onChange={(e) =>
                  setCsvConfig(prev => ({ ...prev, quoteChar: e.target.value }))
                }
                placeholder='"'
                maxLength={1}
              />
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <div className="flex items-center gap-4">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex-1"
              />
              <Button
                onClick={handleParseCSV}
                disabled={!csvFile || isParsing}
              >
                {isParsing ? (
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
            {csvFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Validation Results</span>
              {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
            <CardDescription>
              Review the validation results before proceeding with updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4">
              {successCount > 0 && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {successCount} Success
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="default" className="bg-yellow-500">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {warningCount} Warning
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {errorCount} Error
                </Badge>
              )}
            </div>

            {/* Results List */}
            <div className="space-y-2">
              {validationResults.map((result) => (
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
          </CardContent>
        </Card>
      )}

      {/* Parsed Data Preview */}
      {parsedData.headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>
              Showing first 10 rows of {parsedData.rowCount} total rows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {parsedData.headers.slice(0, 8).map((header) => (
                      <TableHead key={header} className="font-semibold">
                        {header}
                      </TableHead>
                    ))}
                    {parsedData.headers.length > 8 && (
                      <TableHead className="font-semibold">...</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.rows.slice(0, 10).map((row) => (
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
            {parsedData.rowCount > 10 && (
              <p className="text-sm text-muted-foreground mt-4">
                ... and {parsedData.rowCount - 10} more rows
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {parsedData.headers.length > 0 && errorCount === 0 && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setCsvFile(null)
              setParsedData(EMPTY_PARSED_DATA)
              setValidationResults(EMPTY_VALIDATION_RESULTS)
            }}
          >
            Clear
          </Button>
          <Button disabled>
            <Upload className="h-4 w-4 mr-2" />
            Process Updates (Coming Soon)
          </Button>
        </div>
      )}
    </div>
  )
}
