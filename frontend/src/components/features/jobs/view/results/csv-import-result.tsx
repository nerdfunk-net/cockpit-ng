"use client"

import { useState } from "react"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  SkipForward,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CsvImportItem, CsvImportJobResult } from "../types/job-results"

interface CsvImportResultViewProps {
  result: CsvImportJobResult
}

const IMPORT_TYPE_LABELS: Record<string, string> = {
  devices: "Devices",
  "ip-prefixes": "IP Prefixes",
  "ip-addresses": "IP Addresses",
}

// ─── Shared collapsible item list ────────────────────────────────────────────

interface ItemListCardProps {
  title: string
  icon: React.ReactNode
  items: CsvImportItem[]
  colorClass: string          // e.g. "border-green-200 bg-green-50/50"
  badgeClass: string          // e.g. "bg-green-100 text-green-700 border-green-300"
  badgeLabel: string
  defaultOpen?: boolean
}

function ItemListCard({
  title,
  icon,
  items,
  colorClass,
  badgeClass,
  badgeLabel,
  defaultOpen = false,
}: ItemListCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (items.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title} ({items.length})
          </CardTitle>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            {open ? (
              <><ChevronUp className="h-4 w-4" />Collapse</>
            ) : (
              <><ChevronDown className="h-4 w-4" />Expand</>
            )}
          </button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={`item-${item.file ?? ''}-${item.row ?? index}-${item.identifier ?? index}`}
                className={`border rounded-lg p-3 ${colorClass}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">
                    {item.identifier ?? `Row ${item.row ?? index + 1}`}
                  </span>
                  <Badge variant="outline" className={`text-xs ${badgeClass}`}>
                    {badgeLabel}
                  </Badge>
                  {item.file && (
                    <Badge variant="outline" className="text-xs font-mono bg-white">
                      {item.file}
                    </Badge>
                  )}
                  {item.row !== undefined && (
                    <span className="text-xs text-muted-foreground">Row {item.row}</span>
                  )}
                  {item.id && (
                    <span className="text-xs text-muted-foreground font-mono">id: {item.id}</span>
                  )}
                  {item.dry_run && (
                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                      Dry Run
                    </Badge>
                  )}
                </div>
                {item.updated_fields && item.updated_fields.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Fields: {item.updated_fields.join(", ")}
                  </p>
                )}
                {item.reason && (
                  <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function CsvImportResultView({ result }: CsvImportResultViewProps) {
  const [showFailures, setShowFailures] = useState(true)

  const importTypeLabel = IMPORT_TYPE_LABELS[result.import_type] ?? result.import_type
  const hasFailures = result.failures && result.failures.length > 0
  const createdItems = result.created ?? []
  const updatedItems = result.updated ?? []
  const skippedItems = result.skipped ?? []

  return (
    <div className="space-y-4">
      {/* Dry Run Banner */}
      {result.dry_run && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <Info className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Dry Run Mode</p>
            <p className="text-sm text-yellow-700">
              No changes were written. This was a validation preview only.
            </p>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            CSV Import Summary
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {importTypeLabel}
            {result.dry_run && (
              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                Dry Run
              </Badge>
            )}
            {result.timestamp && (
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(result.timestamp).toLocaleString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-600">{result.summary.files_processed}</p>
              <p className="text-xs text-muted-foreground">Files</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <FileText className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-700">{result.summary.total}</p>
              <p className="text-xs text-muted-foreground">Total Rows</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Plus className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">{result.summary.created}</p>
              <p className="text-xs text-muted-foreground">Created</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <RefreshCw className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-600">{result.summary.updated}</p>
              <p className="text-xs text-muted-foreground">Updated</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <SkipForward className="h-4 w-4 text-yellow-500" />
              </div>
              <p className="text-2xl font-bold text-yellow-600">{result.summary.skipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-600">{result.summary.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>

          {/* Progress bar */}
          {result.summary.total > 0 && (
            <div className="mt-4">
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                {result.summary.created > 0 && (
                  <div className="bg-green-500" style={{ width: `${(result.summary.created / result.summary.total) * 100}%` }} />
                )}
                {result.summary.updated > 0 && (
                  <div className="bg-blue-500" style={{ width: `${(result.summary.updated / result.summary.total) * 100}%` }} />
                )}
                {result.summary.skipped > 0 && (
                  <div className="bg-yellow-400" style={{ width: `${(result.summary.skipped / result.summary.total) * 100}%` }} />
                )}
                {result.summary.failed > 0 && (
                  <div className="bg-red-500" style={{ width: `${(result.summary.failed / result.summary.total) * 100}%` }} />
                )}
              </div>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground justify-end">
                {result.summary.created > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />Created
                  </span>
                )}
                {result.summary.updated > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />Updated
                  </span>
                )}
                {result.summary.skipped > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />Skipped
                  </span>
                )}
                {result.summary.failed > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />Failed
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Created */}
      <ItemListCard
        title="Created"
        icon={<Plus className="h-5 w-5 text-green-500" />}
        items={createdItems}
        colorClass="border-green-200 bg-green-50/50"
        badgeClass="bg-green-100 text-green-700 border-green-300"
        badgeLabel="Created"
        defaultOpen={false}
      />

      {/* Updated */}
      <ItemListCard
        title="Updated"
        icon={<RefreshCw className="h-5 w-5 text-blue-500" />}
        items={updatedItems}
        colorClass="border-blue-200 bg-blue-50/50"
        badgeClass="bg-blue-100 text-blue-700 border-blue-300"
        badgeLabel="Updated"
        defaultOpen={false}
      />

      {/* Skipped */}
      <ItemListCard
        title="Skipped"
        icon={<SkipForward className="h-5 w-5 text-yellow-500" />}
        items={skippedItems}
        colorClass="border-yellow-200 bg-yellow-50/50"
        badgeClass="bg-yellow-100 text-yellow-700 border-yellow-300"
        badgeLabel="Skipped"
        defaultOpen={false}
      />

      {/* Failures */}
      {hasFailures && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Failures ({result.failures.length})
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowFailures(!showFailures)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                {showFailures ? (
                  <><ChevronUp className="h-4 w-4" />Collapse</>
                ) : (
                  <><ChevronDown className="h-4 w-4" />Expand</>
                )}
              </button>
            </div>
          </CardHeader>
          {showFailures && (
            <CardContent>
              <div className="space-y-2">
                {result.failures.map((failure, index) => (
                  <div
                    key={`failure-${failure.file ?? ''}-${failure.row ?? index}-${failure.identifier ?? index}`}
                    className="border border-red-200 rounded-lg p-3 bg-red-50/50"
                  >
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {failure.identifier && (
                            <span className="font-medium text-sm text-gray-900">
                              {failure.identifier}
                            </span>
                          )}
                          {failure.file && (
                            <Badge variant="outline" className="text-xs font-mono bg-white">
                              {failure.file}
                            </Badge>
                          )}
                          {failure.row !== undefined && (
                            <span className="text-xs text-muted-foreground">Row {failure.row}</span>
                          )}
                        </div>
                        <p className="text-sm text-red-700 break-words">
                          {failure.error ?? failure.reason ?? "Unknown error"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* All clear */}
      {result.success && !hasFailures && result.summary.total > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-800">
            All rows processed successfully with no errors.
          </p>
        </div>
      )}
    </div>
  )
}
