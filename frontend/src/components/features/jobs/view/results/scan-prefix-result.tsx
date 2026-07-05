'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScanPrefixJobResult, PrefixScanResult } from '../types/job-results'
import {
  Network,
  CheckCircle2,
  XCircle,
  Activity,
  ChevronDown,
  ChevronUp,
  Globe,
} from 'lucide-react'

interface ScanPrefixResultViewProps {
  result: ScanPrefixJobResult
}

const EMPTY_PREFIXES: PrefixScanResult[] = []

export function ScanPrefixResultView({ result }: ScanPrefixResultViewProps) {
  const [expandedPrefixes, setExpandedPrefixes] = useState<Set<string>>(new Set())

  const prefixes = result.prefixes || EMPTY_PREFIXES

  const togglePrefix = (prefix: string) => {
    const newExpanded = new Set(expandedPrefixes)
    if (newExpanded.has(prefix)) {
      newExpanded.delete(prefix)
    } else {
      newExpanded.add(prefix)
    }
    setExpandedPrefixes(newExpanded)
  }

  const expandAll = () => {
    setExpandedPrefixes(new Set(prefixes.map(p => p.prefix)))
  }

  const collapseAll = () => {
    setExpandedPrefixes(new Set())
  }

  return (
    <div className="space-y-4">
      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Scan Summary
          </CardTitle>
          <CardDescription>
            Network prefix scanning results
            {result.resolve_dns && (
              <span className="ml-2 text-xs bg-info text-info-foreground px-2 py-0.5 rounded">
                <Globe className="h-3 w-3 inline mr-1" />
                DNS Resolved
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Prefixes</p>
              <p className="text-2xl font-bold">{result.total_prefixes}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total IPs Scanned</p>
              <p className="text-2xl font-bold">
                {result.total_ips_scanned.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Reachable</p>
              <p className="text-2xl font-bold text-success-foreground">
                {result.total_reachable.toLocaleString()}
                <span className="text-sm text-muted-foreground ml-1">
                  (
                  {result.total_ips_scanned > 0
                    ? (
                        (result.total_reachable / result.total_ips_scanned) *
                        100
                      ).toFixed(1)
                    : 0}
                  %)
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Unreachable</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {result.total_unreachable.toLocaleString()}
                <span className="text-sm text-muted-foreground ml-1">
                  (
                  {result.total_ips_scanned > 0
                    ? (
                        (result.total_unreachable / result.total_ips_scanned) *
                        100
                      ).toFixed(1)
                    : 0}
                  %)
                </span>
              </p>
            </div>
          </div>

          {/* Scan Configuration */}
          <div className="mt-4 p-3 bg-muted border border-border rounded-md">
            <p className="text-sm text-foreground">
              <Network className="h-4 w-4 inline mr-1" />
              Filtered by:{' '}
              <code className="bg-card px-2 py-0.5 rounded text-xs">
                {result.custom_field_name} = {result.custom_field_value}
              </code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Per-Prefix Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Prefix Details</CardTitle>
              <CardDescription>Breakdown by network prefix</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={expandAll} variant="outline" size="sm">
                Expand All
              </Button>
              <Button onClick={collapseAll} variant="outline" size="sm">
                Collapse All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {prefixes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Network className="h-12 w-12 mx-auto mb-2 opacity-40" />
                <p>No prefixes scanned</p>
              </div>
            ) : (
              prefixes.map(prefix => {
                const isExpanded = expandedPrefixes.has(prefix.prefix)
                const reachabilityPercent =
                  prefix.total_ips > 0
                    ? ((prefix.reachable_count / prefix.total_ips) * 100).toFixed(1)
                    : 0

                return (
                  <div
                    key={prefix.prefix}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Prefix Header */}
                    <button
                      onClick={() => togglePrefix(prefix.prefix)}
                      className="w-full p-4 bg-muted hover:bg-muted/70 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Network className="h-5 w-5 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-semibold text-foreground">
                            {prefix.prefix}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {prefix.total_ips.toLocaleString()} IPs scanned
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="status-success border">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {prefix.reachable_count} ({reachabilityPercent}%)
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-muted text-muted-foreground border-border"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            {prefix.unreachable_count}
                          </Badge>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expandable Content */}
                    {isExpanded && (
                      <div className="p-4 space-y-4">
                        {/* Reachable IPs */}
                        {prefix.reachable.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-success-foreground mb-2 flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              Reachable IPs ({prefix.reachable_count})
                            </h4>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                              {prefix.reachable.map(ip => (
                                <div
                                  key={`${prefix.prefix}-${ip.ip}`}
                                  className="flex items-center justify-between p-2 bg-success border border-success-border rounded text-sm"
                                >
                                  <span className="font-mono text-success-foreground">
                                    {ip.ip}
                                  </span>
                                  {ip.hostname && (
                                    <span className="text-success-foreground flex items-center gap-1">
                                      <Globe className="h-3 w-3" />
                                      {ip.hostname}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Unreachable IPs */}
                        {prefix.unreachable.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                              <XCircle className="h-4 w-4" />
                              Unreachable IP Ranges ({prefix.unreachable_count})
                            </h4>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {prefix.unreachable.slice(0, 5).map(range => (
                                <div
                                  key={`${prefix.prefix}-${range}`}
                                  className="p-2 bg-muted border border-border rounded text-sm font-mono text-foreground"
                                >
                                  {range}
                                </div>
                              ))}
                              {prefix.unreachable.length > 5 && (
                                <p className="text-xs text-muted-foreground italic p-2">
                                  ... and {prefix.unreachable.length - 5} more ranges
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Empty state */}
                        {prefix.reachable.length === 0 &&
                          prefix.unreachable.length === 0 && (
                            <p className="text-sm text-muted-foreground italic text-center py-4">
                              No detailed results available
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {result.error && (
        <Card className="border-error-border bg-error">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 text-error-foreground">
              <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Error</p>
                <p className="text-sm">{result.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
