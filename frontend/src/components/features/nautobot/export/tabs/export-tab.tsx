import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Download, FileText, AlertCircle, Eye } from 'lucide-react'
import type { DeviceInfo } from '@/components/shared/device-selector'
import { PreviewExportDialog } from '@/components/features/nautobot/export/dialogs'

interface ExportTabProps {
  selectedDevices: DeviceInfo[]
  selectedProperties: string[]
  exportFormat: 'yaml' | 'csv'
  onExportFormatChange: (format: 'yaml' | 'csv') => void
  csvDelimiter: string
  onCsvDelimiterChange: (delimiter: string) => void
  csvQuoteChar: string
  onCsvQuoteCharChange: (quoteChar: string) => void
  csvIncludeHeaders: boolean
  onCsvIncludeHeadersChange: (include: boolean) => void
  onExport: () => void
}

export function ExportTab({
  selectedDevices,
  selectedProperties,
  exportFormat,
  onExportFormatChange,
  csvDelimiter,
  onCsvDelimiterChange,
  csvQuoteChar,
  onCsvQuoteCharChange,
  csvIncludeHeaders,
  onCsvIncludeHeadersChange,
  onExport,
}: ExportTabProps) {
  const canExport = selectedDevices.length > 0 && selectedProperties.length > 0
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div className="space-y-6">
      {/* Summary Alert */}
      <Alert className={canExport ? 'status-info' : 'status-warning'}>
        {canExport ? (
          <FileText className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <AlertDescription>
          {canExport ? (
            <>
              Ready to export <strong>{selectedDevices.length}</strong> device
              {selectedDevices.length !== 1 ? 's' : ''} with{' '}
              <strong>{selectedProperties.length}</strong> propert
              {selectedProperties.length !== 1 ? 'ies' : 'y'}
            </>
          ) : (
            <>
              Please select devices and properties before exporting.
              {selectedDevices.length === 0 && ' No devices selected.'}
              {selectedProperties.length === 0 && ' No properties selected.'}
            </>
          )}
        </AlertDescription>
      </Alert>

      {/* Export Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Export Summary</CardTitle>
          <CardDescription>Review your export configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Devices</p>
              <p className="text-2xl font-bold text-foreground">
                {selectedDevices.length}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Properties</p>
              <p className="text-2xl font-bold text-foreground">
                {selectedProperties.length}
              </p>
            </div>
          </div>

          {selectedProperties.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Selected Properties:
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedProperties.map(prop => (
                  <span
                    key={prop}
                    className="px-3 py-1 bg-info text-info-foreground rounded-full text-sm font-medium"
                  >
                    {prop}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Format Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Export Format</CardTitle>
          <CardDescription>Choose the output format for your export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onExportFormatChange('yaml')}
              className={`p-4 border-2 rounded-lg transition-all ${
                exportFormat === 'yaml'
                  ? 'border-primary bg-info shadow-sm'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <FileText
                  className={
                    exportFormat === 'yaml' ? 'text-primary' : 'text-muted-foreground'
                  }
                />
                <div className="text-left">
                  <p className="font-semibold text-foreground">YAML</p>
                  <p className="text-xs text-muted-foreground">Structured data format</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => onExportFormatChange('csv')}
              className={`p-4 border-2 rounded-lg transition-all ${
                exportFormat === 'csv'
                  ? 'border-primary bg-info shadow-sm'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <FileText
                  className={
                    exportFormat === 'csv' ? 'text-primary' : 'text-muted-foreground'
                  }
                />
                <div className="text-left">
                  <p className="font-semibold text-foreground">CSV</p>
                  <p className="text-xs text-muted-foreground">Spreadsheet format</p>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* CSV Options */}
      {exportFormat === 'csv' && (
        <Card>
          <CardHeader>
            <CardTitle>CSV Options</CardTitle>
            <CardDescription>Configure CSV export parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delimiter">Delimiter</Label>
                <Input
                  id="delimiter"
                  value={csvDelimiter}
                  onChange={e => onCsvDelimiterChange(e.target.value)}
                  placeholder=","
                  maxLength={1}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Character to separate values (e.g., comma, semicolon)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quotechar">Quote Character</Label>
                <Input
                  id="quotechar"
                  value={csvQuoteChar}
                  onChange={e => onCsvQuoteCharChange(e.target.value)}
                  placeholder='"'
                  maxLength={1}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Character to quote text values
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="include-headers"
                checked={csvIncludeHeaders}
                onCheckedChange={checked => onCsvIncludeHeadersChange(checked === true)}
              />
              <Label htmlFor="include-headers" className="cursor-pointer">
                Include column headers in first row
              </Label>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Preview Settings:
              </p>
              <div className="font-mono text-xs text-muted-foreground space-y-1">
                <p>
                  Delimiter:{' '}
                  <span className="font-bold">{csvDelimiter || '(empty)'}</span>
                </p>
                <p>
                  Quote Char:{' '}
                  <span className="font-bold">{csvQuoteChar || '(empty)'}</span>
                </p>
                <p>
                  Headers:{' '}
                  <span className="font-bold">{csvIncludeHeaders ? 'Yes' : 'No'}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={() => setShowPreview(true)}
          disabled={!canExport}
          size="lg"
          variant="outline"
          className="gap-2 border-success-border text-success-foreground hover:bg-success"
        >
          <Eye className="h-5 w-5" />
          Preview
        </Button>
        <Button onClick={onExport} disabled={!canExport} size="lg" className="gap-2">
          <Download className="h-5 w-5" />
          Export to {exportFormat.toUpperCase()}
        </Button>
      </div>

      {/* Preview Dialog */}
      <PreviewExportDialog
        show={showPreview}
        onClose={() => setShowPreview(false)}
        devices={selectedDevices}
        properties={selectedProperties}
        format={exportFormat}
        csvOptions={
          exportFormat === 'csv'
            ? {
                delimiter: csvDelimiter,
                quoteChar: csvQuoteChar,
                includeHeaders: csvIncludeHeaders,
              }
            : undefined
        }
      />
    </div>
  )
}
