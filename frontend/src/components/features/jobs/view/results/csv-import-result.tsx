'use client'

import { useState } from 'react'
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  SkipForward,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusAlert } from '@/components/shared/status-alert'
import { StatusBadge, type StatusVariant } from '@/components/shared/status-badge'
import { StatusIcon } from '@/components/shared/status-icon'
import { CsvImportItem, CsvImportJobResult } from '../types/job-results'

interface CsvImportResultViewProps {
  result: CsvImportJobResult
}

const IMPORT_TYPE_LABELS: Record<string, string> = {
  devices: 'Devices',
  'ip-prefixes': 'IP Prefixes',
  'ip-addresses': 'IP Addresses',
}

// ─── Shared collapsible item list ────────────────────────────────────────────

const CARD_COLOR_CLASSES: Record<StatusVariant, string> = {
  success: 'border-success-border bg-success/50',
  info: 'border-info-border bg-info/50',
  warning: 'border-warning-border bg-warning/50',
  error: 'border-error-border bg-error/50',
}

interface ItemListCardProps {
  title: string
  icon: React.ReactNode
  items: CsvImportItem[]
  variant: StatusVariant
  badgeLabel: string
  defaultOpen?: boolean
}

function ItemListCard({
  title,
  icon,
  items,
  variant,
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
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {open ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Expand
              </>
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
                className={`border rounded-lg p-3 ${CARD_COLOR_CLASSES[variant]}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm text-foreground">
                    {item.identifier ?? `Row ${item.row ?? index + 1}`}
                  </span>
                  <StatusBadge variant={variant} className="text-xs">
                    {badgeLabel}
                  </StatusBadge>
                  {item.file && (
                    <Badge variant="outline" className="text-xs font-mono bg-card">
                      {item.file}
                    </Badge>
                  )}
                  {item.row !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      Row {item.row}
                    </span>
                  )}
                  {item.id && (
                    <span className="text-xs text-muted-foreground font-mono">
                      id: {item.id}
                    </span>
                  )}
                  {item.dry_run && (
                    <StatusBadge variant="warning" className="text-xs">
                      Dry Run
                    </StatusBadge>
                  )}
                </div>
                {item.updated_fields && item.updated_fields.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Fields: {item.updated_fields.join(', ')}
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
        <StatusAlert variant="warning">
          <p className="text-sm font-medium">Dry Run Mode</p>
          <p className="text-sm">
            No changes were written. This was a validation preview only.
          </p>
        </StatusAlert>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon variant={result.success ? 'success' : 'error'} />
            CSV Import Summary
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {importTypeLabel}
            {result.dry_run && (
              <StatusBadge variant="warning" className="text-xs">
                Dry Run
              </StatusBadge>
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
                <FileText className="h-4 w-4 text-info-foreground" />
              </div>
              <p className="text-2xl font-bold text-info-foreground">
                {result.summary.files_processed}
              </p>
              <p className="text-xs text-muted-foreground">Files</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{result.summary.total}</p>
              <p className="text-xs text-muted-foreground">Total Rows</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Plus className="h-4 w-4 text-success-foreground" />
              </div>
              <p className="text-2xl font-bold text-success-foreground">
                {result.summary.created}
              </p>
              <p className="text-xs text-muted-foreground">Created</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <RefreshCw className="h-4 w-4 text-info-foreground" />
              </div>
              <p className="text-2xl font-bold text-info-foreground">
                {result.summary.updated}
              </p>
              <p className="text-xs text-muted-foreground">Updated</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <SkipForward className="h-4 w-4 text-warning-foreground" />
              </div>
              <p className="text-2xl font-bold text-warning-foreground">
                {result.summary.skipped}
              </p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <StatusIcon variant="error" className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-error-foreground">
                {result.summary.failed}
              </p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>

          {/* Progress bar */}
          {result.summary.total > 0 && (
            <div className="mt-4">
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                {result.summary.created > 0 && (
                  <div
                    className="bg-success-foreground"
                    style={{
                      width: `${(result.summary.created / result.summary.total) * 100}%`,
                    }}
                  />
                )}
                {result.summary.updated > 0 && (
                  <div
                    className="bg-info-foreground"
                    style={{
                      width: `${(result.summary.updated / result.summary.total) * 100}%`,
                    }}
                  />
                )}
                {result.summary.skipped > 0 && (
                  <div
                    className="bg-warning-foreground"
                    style={{
                      width: `${(result.summary.skipped / result.summary.total) * 100}%`,
                    }}
                  />
                )}
                {result.summary.failed > 0 && (
                  <div
                    className="bg-error-foreground"
                    style={{
                      width: `${(result.summary.failed / result.summary.total) * 100}%`,
                    }}
                  />
                )}
              </div>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground justify-end">
                {result.summary.created > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-success-foreground" />
                    Created
                  </span>
                )}
                {result.summary.updated > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-info-foreground" />
                    Updated
                  </span>
                )}
                {result.summary.skipped > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-warning-foreground" />
                    Skipped
                  </span>
                )}
                {result.summary.failed > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-error-foreground" />
                    Failed
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
        icon={<Plus className="h-5 w-5 text-success-foreground" />}
        items={createdItems}
        variant="success"
        badgeLabel="Created"
        defaultOpen={false}
      />

      {/* Updated */}
      <ItemListCard
        title="Updated"
        icon={<RefreshCw className="h-5 w-5 text-info-foreground" />}
        items={updatedItems}
        variant="info"
        badgeLabel="Updated"
        defaultOpen={false}
      />

      {/* Skipped */}
      <ItemListCard
        title="Skipped"
        icon={<SkipForward className="h-5 w-5 text-warning-foreground" />}
        items={skippedItems}
        variant="warning"
        badgeLabel="Skipped"
        defaultOpen={false}
      />

      {/* Failures */}
      {hasFailures && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <StatusIcon variant="error" />
                Failures ({result.failures.length})
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowFailures(!showFailures)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showFailures ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expand
                  </>
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
                    className="border border-error-border rounded-lg p-3 bg-error/50"
                  >
                    <div className="flex items-start gap-2">
                      <StatusIcon variant="error" className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {failure.identifier && (
                            <span className="font-medium text-sm text-foreground">
                              {failure.identifier}
                            </span>
                          )}
                          {failure.file && (
                            <Badge
                              variant="outline"
                              className="text-xs font-mono bg-card"
                            >
                              {failure.file}
                            </Badge>
                          )}
                          {failure.row !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              Row {failure.row}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-error-foreground break-words">
                          {failure.error ?? failure.reason ?? 'Unknown error'}
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
        <StatusAlert variant="success">
          All rows processed successfully with no errors.
        </StatusAlert>
      )}
    </div>
  )
}
