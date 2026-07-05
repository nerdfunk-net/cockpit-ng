'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusAlert } from '@/components/shared/status-alert'
import { StatusBadge } from '@/components/shared/status-badge'
import { StatusIcon } from '@/components/shared/status-icon'
import {
  IPAddressesJobResult,
  IPAddressEntry,
  IPRemovedEntry,
  IPSkippedEntry,
  IPFailedEntry,
} from '../types/job-results'
import { Network, Search, Trash2, List, SkipForward, Tag, Plug } from 'lucide-react'

interface IPAddressesResultViewProps {
  result: IPAddressesJobResult
}

const EMPTY_IPS: IPAddressEntry[] = []
const EMPTY_REMOVED: IPRemovedEntry[] = []
const EMPTY_SKIPPED: IPSkippedEntry[] = []
const EMPTY_FAILED: IPFailedEntry[] = []

function buildFilterLabel(field: string, type: string | null, value: string): string {
  const operator = type ? `__${type}` : ''
  return `${field}${operator} = "${value}"`
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color ?? ''}`}>{value}</p>
    </div>
  )
}

export function IPAddressesResultView({ result }: IPAddressesResultViewProps) {
  const [listSearch, setListSearch] = useState('')
  const [removedSearch, setRemovedSearch] = useState('')
  const [skippedSearch, setSkippedSearch] = useState('')

  const ipAddresses = result.ip_addresses ?? EMPTY_IPS
  const deletedIps = result.deleted_ips ?? EMPTY_REMOVED
  const skippedIps = result.skipped_ips ?? EMPTY_SKIPPED
  const failedIps = result.failed_ips ?? EMPTY_FAILED

  const filteredList = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    if (!q) return ipAddresses
    return ipAddresses.filter(
      ip =>
        ip.address.toLowerCase().includes(q) ||
        ip.dns_name?.toLowerCase().includes(q) ||
        ip.description?.toLowerCase().includes(q)
    )
  }, [ipAddresses, listSearch])

  const filteredRemoved = useMemo(() => {
    const q = removedSearch.trim().toLowerCase()
    if (!q) return deletedIps
    return deletedIps.filter(ip => ip.address.toLowerCase().includes(q))
  }, [deletedIps, removedSearch])

  const filteredSkipped = useMemo(() => {
    const q = skippedSearch.trim().toLowerCase()
    if (!q) return skippedIps
    return skippedIps.filter(
      ip =>
        ip.address.toLowerCase().includes(q) ||
        ip.interface_assignments.some(a => a.interface?.toLowerCase().includes(q))
    )
  }, [skippedIps, skippedSearch])

  const filterLabel = buildFilterLabel(
    result.filter_field,
    result.filter_type,
    result.filter_value
  )
  const isRemove = result.action === 'remove' || result.action === 'delete'
  const isMark = result.action === 'mark'
  const customField = result.filter_field.startsWith('cf_') ? result.filter_field : null

  return (
    <div className="space-y-4">
      {/* ── Summary Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isRemove ? (
              <Trash2 className="h-5 w-5 text-destructive" />
            ) : isMark ? (
              <Tag className="h-5 w-5 text-warning-foreground" />
            ) : (
              <List className="h-5 w-5 text-primary" />
            )}
            {isRemove
              ? 'Remove IP Addresses'
              : isMark
                ? 'Mark IP Addresses'
                : 'List IP Addresses'}
          </CardTitle>
          <CardDescription className="font-mono text-xs">{filterLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-1">
                <StatusIcon
                  variant={result.success ? 'success' : 'error'}
                  className="h-4 w-4"
                />
                <span
                  className={`text-sm font-medium ${result.success ? 'text-success-foreground' : 'text-error-foreground'}`}
                >
                  {result.success ? 'Success' : 'Failed'}
                </span>
              </div>
            </div>

            <StatBox label="Total Found" value={result.total} />

            {isRemove && (
              <>
                <StatBox
                  label="Deleted"
                  value={result.deleted ?? 0}
                  color="text-success-foreground"
                />
                <StatBox
                  label="Skipped"
                  value={result.skipped ?? 0}
                  color="text-warning-foreground"
                />
                <StatBox
                  label="Failed"
                  value={result.failed ?? 0}
                  color={result.failed ? 'text-error-foreground' : undefined}
                />
              </>
            )}

            {isMark && (
              <>
                <StatBox
                  label="Updated"
                  value={result.updated ?? 0}
                  color="text-success-foreground"
                />
                <StatBox
                  label="Failed"
                  value={result.failed ?? 0}
                  color={result.failed ? 'text-error-foreground' : undefined}
                />
              </>
            )}

            {!isRemove && !isMark && (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Filter</p>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {result.filter_type ?? 'eq'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Null Included</p>
                  <Badge
                    variant={result.include_null ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    {result.include_null ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </>
            )}
          </div>

          {isRemove && (result.failed ?? 0) > 0 && (
            <StatusAlert variant="warning">
              {result.failed} IP address{(result.failed ?? 0) > 1 ? 'es' : ''} could not
              be deleted.
            </StatusAlert>
          )}
        </CardContent>
      </Card>

      {/* ── List: IP Address Table ── */}
      {!isRemove && !isMark && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  IP Addresses
                </CardTitle>
                <CardDescription>
                  {filteredList.length === ipAddresses.length
                    ? `${ipAddresses.length} addresses`
                    : `${filteredList.length} of ${ipAddresses.length} addresses`}
                </CardDescription>
              </div>
              <div className="relative w-56 shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address, hostname…"
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ipAddresses.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Network className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No IP addresses matched the filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead className="w-16 text-center">Ver</TableHead>
                      <TableHead>DNS Name</TableHead>
                      <TableHead>Description</TableHead>
                      {customField && (
                        <TableHead>
                          {customField.replace(/^cf_/, '').replace(/_/g, ' ')}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredList.map(ip => (
                      <TableRow key={ip.id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {ip.address}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              ip.ip_version === 6
                                ? 'border-border text-foreground'
                                : 'border-info-border text-info-foreground'
                            }`}
                          >
                            v{ip.ip_version}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ip.dns_name || <span className="opacity-40">—</span>}
                        </TableCell>
                        <TableCell
                          className="text-sm text-muted-foreground max-w-xs truncate"
                          title={ip.description}
                        >
                          {ip.description || <span className="opacity-40">—</span>}
                        </TableCell>
                        {customField && (
                          <TableCell className="text-sm">
                            {ip[customField] != null ? (
                              <span className="font-mono">
                                {String(ip[customField])}
                              </span>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs border-border text-muted-foreground"
                              >
                                null
                              </Badge>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {filteredList.length > 20 && (
            <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">
              {filteredList.length} rows
            </div>
          )}
        </Card>
      )}

      {/* ── Remove: Deleted IPs table ── */}
      {isRemove && deletedIps.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <StatusIcon variant="success" className="h-4 w-4" />
                  Deleted IPs
                  <StatusBadge variant="success">{deletedIps.length}</StatusBadge>
                </CardTitle>
                <CardDescription>
                  IP addresses permanently removed from Nautobot
                </CardDescription>
              </div>
              <div className="relative w-48 shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address…"
                  value={removedSearch}
                  onChange={e => setRemovedSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-muted-foreground">ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRemoved.map(ip => (
                    <TableRow key={ip.id}>
                      <TableCell className="font-mono text-sm font-medium text-success-foreground">
                        {ip.address}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {ip.id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          {filteredRemoved.length > 20 && (
            <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">
              {filteredRemoved.length} rows
            </div>
          )}
        </Card>
      )}

      {/* ── Remove: Skipped IPs table ── */}
      {isRemove && skippedIps.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <SkipForward className="h-4 w-4 text-warning-foreground" />
                  Skipped IPs
                  <StatusBadge variant="warning">{skippedIps.length}</StatusBadge>
                </CardTitle>
                <CardDescription>
                  Assigned IP addresses protected from deletion
                </CardDescription>
              </div>
              <div className="relative w-48 shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address, interface…"
                  value={skippedSearch}
                  onChange={e => setSkippedSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSkipped.map(ip => (
                    <TableRow key={ip.id}>
                      <TableCell className="font-mono text-sm font-medium text-warning-foreground">
                        {ip.address}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {ip.interface_assignments.map((a, i) => (
                            <Badge
                              key={a.id ?? i}
                              variant="outline"
                              className="text-xs border-warning-border text-warning-foreground flex items-center gap-1"
                            >
                              <Plug className="h-3 w-3" />
                              {a.device
                                ? `${a.device} → ${a.interface ?? '(unknown)'}`
                                : (a.interface ?? '(unknown)')}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          {filteredSkipped.length > 20 && (
            <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">
              {filteredSkipped.length} rows
            </div>
          )}
        </Card>
      )}

      {/* ── Remove: Failed IPs table ── */}
      {isRemove && failedIps.length > 0 && (
        <Card className="border-error-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <StatusIcon variant="error" className="h-4 w-4" />
              Failed IPs
              <StatusBadge variant="error">{failedIps.length}</StatusBadge>
            </CardTitle>
            <CardDescription>IP addresses that could not be deleted</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedIps.map((ip, idx) => (
                    <TableRow key={ip.id ?? idx}>
                      <TableCell className="font-mono text-sm font-medium text-error-foreground">
                        {ip.address}
                      </TableCell>
                      <TableCell className="text-sm text-error-foreground">
                        {ip.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
