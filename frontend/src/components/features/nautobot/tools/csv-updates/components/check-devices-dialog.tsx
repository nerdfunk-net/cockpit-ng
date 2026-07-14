'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusIcon } from '@/components/shared/status-icon'
import { useCheckDevices } from '../hooks/use-check-devices'
import { useFilterPagination } from '../hooks/use-filter-pagination'
import { CsvFilterPagination } from './csv-filter-pagination'

type StatusFilter = 'all' | 'found' | 'missing'

interface CheckDevicesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceNames: string[]
}

export function CheckDevicesDialog({
  open,
  onOpenChange,
  deviceNames,
}: CheckDevicesDialogProps) {
  const { isChecking, progress, results, runCheck } = useCheckDevices()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    if (open) runCheck(deviceNames)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open) setStatusFilter('all')
  }, [open])

  const foundCount = results.filter(r => r.found).length
  const notFoundCount = results.filter(r => !r.found).length
  const progressPercent =
    progress.total > 0 ? (progress.checked / progress.total) * 100 : 0

  const filteredResults = useMemo(() => {
    if (statusFilter === 'found') return results.filter(r => r.found)
    if (statusFilter === 'missing') return results.filter(r => !r.found)
    return results
  }, [results, statusFilter])

  const { pagination, currentPageItems, handlePageChange, handlePageSizeChange, resetPage } =
    useFilterPagination(filteredResults.length)

  useEffect(() => {
    resetPage()
  }, [statusFilter, results, resetPage])

  const paginatedResults = currentPageItems(filteredResults)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Check Devices
          </DialogTitle>
        </DialogHeader>

        {/* Checking state */}
        {isChecking && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Progress value={progressPercent} className="h-2 w-full" />
            <span className="text-sm text-muted-foreground">
              Checking {progress.checked} / {progress.total} device(s)…
            </span>
          </div>
        )}

        {/* Empty selection */}
        {!isChecking && deviceNames.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No devices selected to check.
          </div>
        )}

        {/* Results */}
        {!isChecking && results.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setStatusFilter('all')}
              >
                All ({results.length})
              </Button>
              <Button
                variant={statusFilter === 'found' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setStatusFilter('found')}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Show existing ({foundCount})
              </Button>
              <Button
                variant={statusFilter === 'missing' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setStatusFilter('missing')}
              >
                <XCircle className="h-3.5 w-3.5" />
                Show missing ({notFoundCount})
              </Button>
            </div>

            {filteredResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No devices match this filter.
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-5" />
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                        Device name
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                        Nautobot
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedResults.map(entry => (
                      <tr
                        key={entry.deviceName}
                        className={entry.found ? '' : 'bg-error/40'}
                      >
                        <td className="px-3 py-2 text-center">
                          <StatusIcon
                            variant={entry.found ? 'success' : 'error'}
                            className="h-3.5 w-3.5 inline"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {entry.deviceName}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {entry.found ? (
                            <span className="text-success-foreground">found</span>
                          ) : (
                            <span className="text-destructive italic">not found</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <CsvFilterPagination
                  pagination={pagination}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            )}
          </>
        )}

        <DialogFooter className="pt-4 border-t mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
