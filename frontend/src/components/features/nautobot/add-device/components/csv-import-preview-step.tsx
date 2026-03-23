'use client'

import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import type { CSVParseResult, DeviceValidationError } from '../types'

interface CsvImportPreviewStepProps {
  parseResult: CSVParseResult
  dryRunErrors: DeviceValidationError[]
}

export function CsvImportPreviewStep({
  parseResult,
  dryRunErrors,
}: CsvImportPreviewStepProps) {
  const errors = parseResult.validationErrors.filter(e => e.severity === 'error')
  const warnings = parseResult.validationErrors.filter(e => e.severity === 'warning')
  const hasBlockingErrors = errors.length > 0

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-600">
          <strong>{parseResult.devices.length}</strong> device(s) from <strong>{parseResult.rowCount}</strong> row(s)
        </span>
        {errors.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {errors.length} error(s)
          </Badge>
        )}
        {warnings.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {warnings.length} warning(s)
          </Badge>
        )}
      </div>

      {/* Validation Errors */}
      {hasBlockingErrors && (
        <Alert className="status-error">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            There are {errors.length} error(s) that must be resolved before importing.
          </AlertDescription>
        </Alert>
      )}

      {!hasBlockingErrors && parseResult.devices.length > 0 && (
        <Alert className="status-success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            All devices passed validation. Ready to import.
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Issues List */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="max-h-32 overflow-y-auto border rounded-lg p-3 space-y-1">
          {errors.map((error, i) => (
            <div key={`err-${i}`} className="flex items-start gap-2 text-xs">
              <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              <span>
                <strong>{error.deviceName}</strong> — {error.field}: {error.message}
              </span>
            </div>
          ))}
          {warnings.map((warning, i) => (
            <div key={`warn-${i}`} className="flex items-start gap-2 text-xs">
              <AlertCircle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
              <span>
                <strong>{warning.deviceName}</strong> — {warning.field}: {warning.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dry Run Errors (additional) */}
      {dryRunErrors.length > 0 && dryRunErrors !== parseResult.validationErrors && (
        <Alert className="status-warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Dry run found {dryRunErrors.filter(e => e.severity === 'error').length} additional error(s).
          </AlertDescription>
        </Alert>
      )}

      {/* Device Preview Table */}
      {parseResult.devices.length > 0 && (
        <div className="border rounded-lg overflow-hidden max-h-[35vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Device Type</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Location</TableHead>
                <TableHead className="text-xs w-24">Interfaces</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parseResult.devices.map((device) => {
                const deviceErrors = parseResult.validationErrors.filter(
                  e => e.deviceName === device.name && e.severity === 'error'
                )
                const hasError = deviceErrors.length > 0

                return (
                  <TableRow key={device.name} className={hasError ? 'bg-red-50' : ''}>
                    <TableCell className="text-xs font-medium">{device.name}</TableCell>
                    <TableCell className="text-xs">
                      {device.device_type || (
                        <span className="text-red-500 italic">missing</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {device.role || (
                        <span className="text-red-500 italic">missing</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {device.status || (
                        <span className="text-red-500 italic">missing</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {device.location || (
                        <span className="text-red-500 italic">missing</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="secondary" className="text-xs">
                        {device.interfaces.length}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
