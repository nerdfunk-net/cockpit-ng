"use client"

import React, { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IPAddressesJobResult, IPAddressEntry } from "../../types/job-results"
import {
  CheckCircle2,
  XCircle,
  Network,
  Search,
  Trash2,
  List,
  AlertCircle,
} from "lucide-react"

interface IPAddressesResultViewProps {
  result: IPAddressesJobResult
}

const EMPTY_IPS: IPAddressEntry[] = []

function buildFilterLabel(field: string, type: string | null, value: string): string {
  const operator = type ? `__${type}` : ""
  return `${field}${operator} = "${value}"`
}

export function IPAddressesResultView({ result }: IPAddressesResultViewProps) {
  const [search, setSearch] = useState("")

  const ipAddresses = result.ip_addresses ?? EMPTY_IPS

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ipAddresses
    return ipAddresses.filter(
      (ip) =>
        ip.address.toLowerCase().includes(q) ||
        ip.dns_name?.toLowerCase().includes(q) ||
        ip.description?.toLowerCase().includes(q)
    )
  }, [ipAddresses, search])

  const filterLabel = buildFilterLabel(result.filter_field, result.filter_type, result.filter_value)
  const isDelete = result.action === "delete"
  const customField = result.filter_field.startsWith("cf_") ? result.filter_field : null

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isDelete ? (
              <Trash2 className="h-5 w-5 text-red-500" />
            ) : (
              <List className="h-5 w-5 text-blue-500" />
            )}
            {isDelete ? "Delete IP Addresses" : "List IP Addresses"}
          </CardTitle>
          <CardDescription className="font-mono text-xs">{filterLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-1">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${result.success ? "text-green-600" : "text-red-600"}`}>
                  {result.success ? "Success" : "Failed"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Found</p>
              <p className="text-2xl font-bold">{result.total}</p>
            </div>

            {isDelete ? (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Deleted</p>
                  <p className="text-2xl font-bold text-green-600">{result.deleted ?? 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{result.failed ?? 0}</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Filter</p>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {result.filter_type ?? "eq"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Null Included</p>
                  <Badge variant={result.include_null ? "default" : "outline"} className="text-xs">
                    {result.include_null ? "Yes" : "No"}
                  </Badge>
                </div>
              </>
            )}
          </div>

          {isDelete && (result.failed ?? 0) > 0 && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                {result.failed} IP address{(result.failed ?? 0) > 1 ? "es" : ""} could not be deleted. Check the raw JSON for details.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* IP Address Table (list action only) */}
      {!isDelete && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  IP Addresses
                </CardTitle>
                <CardDescription>
                  {filtered.length === ipAddresses.length
                    ? `${ipAddresses.length} addresses`
                    : `${filtered.length} of ${ipAddresses.length} addresses`}
                </CardDescription>
              </div>
              <div className="relative w-56 shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search address, hostname…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
                        <TableHead>{customField.replace(/^cf_/, "").replace(/_/g, " ")}</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((ip) => (
                      <TableRow key={ip.id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {ip.address}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs ${ip.ip_version === 6 ? "border-purple-300 text-purple-700" : "border-blue-300 text-blue-700"}`}
                          >
                            v{ip.ip_version}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ip.dns_name || <span className="opacity-40">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={ip.description}>
                          {ip.description || <span className="opacity-40">—</span>}
                        </TableCell>
                        {customField && (
                          <TableCell className="text-sm">
                            {ip[customField] != null ? (
                              <span className="font-mono">{String(ip[customField])}</span>
                            ) : (
                              <Badge variant="outline" className="text-xs border-gray-200 text-gray-400">
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
          {filtered.length > 20 && (
            <div className="px-4 py-2 border-t text-xs text-muted-foreground text-right">
              {filtered.length} rows
            </div>
          )}
        </Card>
      )}

      {/* Delete summary detail */}
      {isDelete && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="h-4 w-4 text-red-500" />
              Deletion Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">
                  <span className="font-bold text-green-600">{result.deleted ?? 0}</span> deleted successfully
                </span>
              </div>
              {(result.failed ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm">
                    <span className="font-bold text-red-600">{result.failed}</span> failed to delete
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">{result.total} total matched</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
