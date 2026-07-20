'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import type { ServerSearchHit } from '../types'

interface SearchResultsTableProps {
  servers: ServerSearchHit[]
}

function formatRamGb(mb: number | null): string {
  if (mb == null) return '—'
  return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
}

export function SearchResultsTable({ servers }: SearchResultsTableProps) {
  if (servers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No servers matched</p>
        <p className="text-sm mt-1">
          Try adjusting your criteria or removing a NOT group
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hostname</TableHead>
            <TableHead>OS Family</TableHead>
            <TableHead>Distribution</TableHead>
            <TableHead>Version</TableHead>
            <TableHead className="text-right">RAM</TableHead>
            <TableHead className="text-right">CPU</TableHead>
            <TableHead className="text-right">Disks</TableHead>
            <TableHead className="text-right">Disk GB</TableHead>
            <TableHead className="text-right">Usage %</TableHead>
            <TableHead>VM</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {servers.map((server) => (
            <TableRow key={server.id}>
              <TableCell className="font-medium text-foreground">
                {server.hostname}
              </TableCell>
              <TableCell>{server.os_family ?? '—'}</TableCell>
              <TableCell>{server.distribution ?? '—'}</TableCell>
              <TableCell>{server.distribution_version ?? '—'}</TableCell>
              <TableCell className="text-right">
                {formatRamGb(server.memtotal_mb)}
              </TableCell>
              <TableCell className="text-right">
                {server.processor_count ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                {server.disk_count ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                {server.disk_total_gb ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                {server.disk_usage_pct != null ? `${server.disk_usage_pct}%` : '—'}
              </TableCell>
              <TableCell>
                {server.is_virtual ? (
                  <StatusBadge variant="info">Yes</StatusBadge>
                ) : (
                  <StatusBadge variant="success">No</StatusBadge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
