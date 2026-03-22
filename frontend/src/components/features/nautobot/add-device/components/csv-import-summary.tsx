'use client'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { ImportSummary } from '../types'

interface CSVImportSummaryProps {
  importSummary: ImportSummary
}

export function CSVImportSummary({ importSummary }: CSVImportSummaryProps) {
  return (
    <div className="space-y-3">
      {/* Summary Counts */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <span className="font-medium">{importSummary.success} succeeded</span>
        </div>
        {importSummary.failed > 0 && (
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="font-medium">{importSummary.failed} failed</span>
          </div>
        )}
        {importSummary.skipped > 0 && (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <span className="font-medium">{importSummary.skipped} skipped</span>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device Name</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {importSummary.results.map((result) => (
              <TableRow key={result.deviceName}>
                <TableCell className="font-medium">{result.deviceName}</TableCell>
                <TableCell>
                  {result.status === 'success' && (
                    <Badge className="bg-green-100 text-green-800">Success</Badge>
                  )}
                  {result.status === 'error' && (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                  {result.status === 'skipped' && (
                    <Badge variant="secondary">Skipped</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{result.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
