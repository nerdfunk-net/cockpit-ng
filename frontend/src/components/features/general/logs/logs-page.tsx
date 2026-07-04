'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  ScrollText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconChip } from '@/components/shared/icon-chip'
import { useLogsQuery, useLogEventTypesQuery } from '@/hooks/queries/use-logs-query'
import { LogsColumnSelector } from './components/logs-column-selector'
import type { ColumnDef } from './components/logs-column-selector'
import type { LogsFilters } from '@/hooks/queries/use-logs-query'

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'username', label: 'Username', defaultVisible: true },
  { id: 'event_type', label: 'Event Type', defaultVisible: true },
  { id: 'message', label: 'Message', defaultVisible: true },
  { id: 'severity', label: 'Severity', defaultVisible: true },
  { id: 'created_at', label: 'Timestamp', defaultVisible: true },
  { id: 'id', label: 'ID', defaultVisible: false },
  { id: 'user_id', label: 'User ID', defaultVisible: false },
  { id: 'ip_address', label: 'IP Address', defaultVisible: false },
  { id: 'resource_type', label: 'Resource Type', defaultVisible: false },
  { id: 'resource_id', label: 'Resource ID', defaultVisible: false },
  { id: 'resource_name', label: 'Resource Name', defaultVisible: false },
  { id: 'extra_data', label: 'Extra Data', defaultVisible: false },
]

const DEFAULT_VISIBLE = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id)

const DEFAULT_WIDTHS: Record<string, number> = {
  username: 120,
  event_type: 140,
  message: 280,
  severity: 90,
  created_at: 160,
  id: 60,
  user_id: 70,
  ip_address: 120,
  resource_type: 130,
  resource_id: 130,
  resource_name: 150,
  extra_data: 200,
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

function SeverityBadge({ severity }: { severity: string }) {
  const classes: Record<string, string> = {
    info: 'status-info',
    warning: 'status-warning',
    error: 'status-error',
    critical: 'status-error font-semibold',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${classes[severity] ?? 'bg-muted text-muted-foreground'}`}
    >
      {severity}
    </span>
  )
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function LogsPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('')
  const [eventType, setEventType] = useState('')
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(DEFAULT_VISIBLE)
  const [columnWidths, setColumnWidths] =
    useState<Record<string, number>>(DEFAULT_WIDTHS)
  const resizingRef = useRef<{
    colId: string
    startX: number
    startWidth: number
  } | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const { colId, startX, startWidth } = resizingRef.current
      const delta = e.clientX - startX
      const newWidth = Math.max(50, startWidth + delta)
      setColumnWidths(prev => ({ ...prev, [colId]: newWidth }))
    }
    const handleMouseUp = () => {
      resizingRef.current = null
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const filters: LogsFilters = useMemo(
    () => ({
      page,
      page_size: pageSize,
      ...(search && { search }),
      ...(severity && { severity }),
      ...(eventType && { event_type: eventType }),
    }),
    [page, pageSize, search, severity, eventType]
  )

  const { data, isLoading, error, refetch } = useLogsQuery(filters)
  const { data: eventTypesData } = useLogEventTypesQuery()
  const eventTypes = eventTypesData?.event_types ?? []

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter(c => visibleColumnIds.includes(c.id)),
    [visibleColumnIds]
  )

  const handleColumnToggle = useCallback((columnId: string, visible: boolean) => {
    setVisibleColumnIds(prev =>
      visible ? [...prev, columnId] : prev.filter(id => id !== columnId)
    )
  }, [])

  const handleResizeStart = useCallback(
    (colId: string, e: React.MouseEvent) => {
      e.preventDefault()
      resizingRef.current = {
        colId,
        startX: e.clientX,
        startWidth: columnWidths[colId] ?? DEFAULT_WIDTHS[colId] ?? 100,
      }
    },
    [columnWidths]
  )

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const handleSeverityChange = useCallback((value: string) => {
    setSeverity(value === 'all' ? '' : value)
    setPage(1)
  }, [])

  const handleEventTypeChange = useCallback((value: string) => {
    setEventType(value === 'all' ? '' : value)
    setPage(1)
  }, [])

  const handlePageSizeChange = useCallback((value: string) => {
    setPageSize(Number(value))
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setSearch('')
    setSeverity('')
    setEventType('')
    setPage(1)
  }, [])

  const hasFilters = !!search || !!severity || !!eventType

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <IconChip variant="warning">
            <ScrollText className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
            <p className="text-muted-foreground mt-1">
              View system and user activity audit trail
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="status-error">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load audit logs.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Section */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
        {/* Gradient header */}
        <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <ScrollText className="h-4 w-4" />
            <div>
              <span className="text-sm font-medium">Audit Log Entries</span>
              <p className="text-panel-header-muted text-xs">
                {isLoading
                  ? 'Loading…'
                  : `Showing ${items.length} of ${total} entries${hasFilters ? ' (filtered)' : ''}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-current hover:bg-card/20 text-xs h-6"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refetch()}
              disabled={isLoading}
              className="text-current hover:bg-card/20 text-xs h-6"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Refresh
            </Button>
            <LogsColumnSelector
              columns={ALL_COLUMNS}
              visibleColumnIds={visibleColumnIds}
              onToggle={handleColumnToggle}
            />
          </div>
        </div>

        {/* Filters row — below gradient title, above table */}
        <div className="px-4 py-2 bg-muted border-b flex flex-wrap gap-2">
          <Input
            placeholder="Search message…"
            value={search}
            onChange={handleSearchChange}
            className="h-7 text-xs w-48"
          />
          <Select value={severity || 'all'} onValueChange={handleSeverityChange}>
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={eventType || 'all'} onValueChange={handleEventTypeChange}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All event types</SelectItem>
              {eventTypes.map(et => (
                <SelectItem key={et} value={et}>
                  {et}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table content */}
        <div className="p-4 panel-content">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading audit logs…
              </span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-lg font-medium">No log entries found</p>
              {hasFilters && (
                <p className="text-sm mt-1">
                  Try{' '}
                  <button
                    onClick={clearFilters}
                    className="text-primary hover:underline"
                  >
                    clearing the filters
                  </button>
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="text-sm"
                style={{
                  tableLayout: 'fixed',
                  width: visibleColumns.reduce(
                    (sum, c) =>
                      sum + (columnWidths[c.id] ?? DEFAULT_WIDTHS[c.id] ?? 100),
                    0
                  ),
                }}
              >
                <colgroup>
                  {visibleColumns.map(col => (
                    <col
                      key={col.id}
                      style={{
                        width: columnWidths[col.id] ?? DEFAULT_WIDTHS[col.id] ?? 100,
                      }}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b bg-muted">
                    {visibleColumns.map(col => (
                      <th
                        key={col.id}
                        className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap relative select-none overflow-hidden"
                      >
                        <span className="block truncate">{col.label}</span>
                        <div
                          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary transition-colors"
                          onMouseDown={e => handleResizeStart(col.id, e)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr
                      key={item.id}
                      className="border-b hover:bg-muted transition-colors"
                    >
                      {visibleColumns.map(col => (
                        <td
                          key={col.id}
                          className="px-3 py-2 align-top overflow-hidden"
                        >
                          {col.id === 'severity' ? (
                            <SeverityBadge severity={item.severity} />
                          ) : col.id === 'created_at' ? (
                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDate(item.created_at)}
                            </span>
                          ) : col.id === 'message' ? (
                            <span className="block truncate" title={item.message}>
                              {item.message}
                            </span>
                          ) : col.id === 'extra_data' ? (
                            <span
                              className="block truncate font-mono text-xs text-muted-foreground"
                              title={item.extra_data ?? ''}
                            >
                              {item.extra_data ?? '—'}
                            </span>
                          ) : (
                            <span className="block truncate">
                              {((item as unknown as Record<string, unknown>)[
                                col.id
                              ] as string) ?? '—'}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination footer */}
        <div className="border-t bg-muted px-4 py-2 flex items-center justify-between gap-4 rounded-b-lg">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page:</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-6 text-xs w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(s => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages} ({total} total)
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
