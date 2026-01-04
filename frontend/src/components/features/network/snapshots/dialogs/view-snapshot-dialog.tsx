/**
 * View Snapshot Dialog
 * Display detailed snapshot information including metadata and per-device command outputs
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { 
  Loader2, 
  Calendar, 
  User, 
  GitBranch, 
  FileCode, 
  Server,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { useSnapshots } from '../hooks/use-snapshots'
import type { Snapshot, SnapshotResult } from '../types/snapshot-types'

interface ViewSnapshotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshotId: number
}

export function ViewSnapshotDialog({
  open,
  onOpenChange,
  snapshotId,
}: ViewSnapshotDialogProps) {
  const { getSnapshot } = useSnapshots()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const loadSnapshot = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSnapshot(snapshotId)
      setSnapshot(data)
    } catch (error) {
      console.error('Failed to load snapshot:', error)
    } finally {
      setLoading(false)
    }
  }, [getSnapshot, snapshotId])

  useEffect(() => {
    if (open && snapshotId) {
      loadSnapshot()
    }
  }, [open, snapshotId, loadSnapshot])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    if (status === 'completed' || status === 'success') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          {status === 'success' ? 'Success' : 'Completed'}
        </Badge>
      )
    } else if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>
    } else if (status === 'running') {
      return <Badge className="bg-blue-600">Running</Badge>
    } else {
      return <Badge variant="secondary">Pending</Badge>
    }
  }

  const parseCommandOutput = (result: SnapshotResult) => {
    if (!result.parsed_data) return null
    try {
      return JSON.parse(result.parsed_data)
    } catch {
      return null
    }
  }

  const renderCommandOutput = (output: unknown) => {
    // Handle TextFSM parsed output (array of objects)
    if (Array.isArray(output)) {
      return (
        <div className="space-y-2">
          {output.map((item, idx) => (
            <div key={`output-${idx}-${JSON.stringify(item).substring(0, 30)}`} className="bg-gray-50 rounded p-3 border">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(item, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )
    }

    // Handle raw text output
    if (typeof output === 'string') {
      return (
        <pre className="bg-gray-900 text-gray-100 rounded p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
          {output}
        </pre>
      )
    }

    // Handle other types
    return (
      <pre className="bg-gray-50 rounded p-4 text-xs font-mono whitespace-pre-wrap">
        {JSON.stringify(output, null, 2)}
      </pre>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[800px] max-h-[90vh] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Snapshot Details
          </DialogTitle>
          <DialogDescription>
            View snapshot information, results, and command outputs
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : snapshot ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="results">Results & Commands</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="h-[500px] overflow-y-auto pr-4">
                <div className="space-y-6">
                  {/* General Information */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-blue-900">
                      <FileCode className="h-5 w-5" />
                      General Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Name</label>
                        <p className="text-sm mt-1 font-mono bg-white/70 px-3 py-2 rounded">
                          {snapshot.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <div className="mt-1">{getStatusBadge(snapshot.status)}</div>
                      </div>
                      {snapshot.template_name && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">Template</label>
                          <p className="text-sm mt-1 font-mono bg-white/70 px-3 py-2 rounded">
                            {snapshot.template_name}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-gray-600">Snapshot Path</label>
                        <p className="text-sm mt-1 font-mono bg-white/70 px-3 py-2 rounded break-all">
                          {snapshot.snapshot_path}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Execution Details */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-5 border border-purple-200">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-purple-900">
                      <Clock className="h-5 w-5" />
                      Execution Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                          <User className="h-4 w-4" />
                          Executed By
                        </label>
                        <p className="text-sm mt-1 bg-white/70 px-3 py-2 rounded">
                          {snapshot.executed_by}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Started At
                        </label>
                        <p className="text-sm mt-1 bg-white/70 px-3 py-2 rounded">
                          {formatDate(snapshot.started_at)}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Completed At
                        </label>
                        <p className="text-sm mt-1 bg-white/70 px-3 py-2 rounded">
                          {formatDate(snapshot.completed_at)}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Duration</label>
                        <p className="text-sm mt-1 bg-white/70 px-3 py-2 rounded">
                          {snapshot.started_at && snapshot.completed_at
                            ? `${Math.round(
                                (new Date(snapshot.completed_at).getTime() -
                                  new Date(snapshot.started_at).getTime()) /
                                  1000
                              )}s`
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-5 border border-green-200">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-green-900">
                      <Server className="h-5 w-5" />
                      Device Statistics
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/70 rounded p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {snapshot.device_count}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">Total Devices</div>
                      </div>
                      <div className="bg-white/70 rounded p-4 text-center">
                        <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-6 w-6" />
                          {snapshot.success_count}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">Successful</div>
                      </div>
                      <div className="bg-white/70 rounded p-4 text-center">
                        <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                          <XCircle className="h-6 w-6" />
                          {snapshot.failed_count}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">Failed</div>
                      </div>
                    </div>
                  </div>

                  {/* Git Information */}
                  {snapshot.git_repository_id && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-5 border border-amber-200">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-amber-900">
                        <GitBranch className="h-5 w-5" />
                        Git Repository
                      </h3>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Repository ID</label>
                        <p className="text-sm mt-1 bg-white/70 px-3 py-2 rounded">
                          {snapshot.git_repository_id}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Results & Commands Tab */}
            <TabsContent value="results" className="space-y-4">
              <div className="h-[500px] overflow-y-auto pr-4">
                {snapshot.results && snapshot.results.length > 0 ? (
                  <Accordion type="single" collapsible className="space-y-2">
                    {snapshot.results.map((result) => {
                      const commandOutputs = parseCommandOutput(result)
                      return (
                        <AccordionItem
                          key={result.id}
                          value={`result-${result.id}`}
                          className="border rounded-lg overflow-hidden"
                        >
                          <AccordionTrigger className="px-4 hover:bg-gray-50 hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3">
                                <Server className="h-4 w-4 text-gray-500" />
                                <span className="font-medium">{result.device_name}</span>
                                {result.device_ip && (
                                  <span className="text-sm text-gray-500 font-mono">
                                    ({result.device_ip})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(result.status)}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-4 pt-2">
                              {/* Result Metadata */}
                              <div className="bg-gray-50 rounded p-3 space-y-2 text-sm">
                                {result.git_file_path && (
                                  <div>
                                    <span className="font-medium text-gray-600">File Path: </span>
                                    <span className="font-mono text-xs">{result.git_file_path}</span>
                                  </div>
                                )}
                                {result.git_commit_hash && (
                                  <div>
                                    <span className="font-medium text-gray-600">Commit: </span>
                                    <span className="font-mono text-xs">
                                      {result.git_commit_hash.substring(0, 8)}
                                    </span>
                                  </div>
                                )}
                                {result.error_message && (
                                  <div className="text-red-600">
                                    <span className="font-medium">Error: </span>
                                    {result.error_message}
                                  </div>
                                )}
                              </div>

                              {/* Command Outputs */}
                              {commandOutputs && Object.keys(commandOutputs).length > 0 ? (
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <ChevronRight className="h-4 w-4" />
                                    Command Outputs
                                  </h4>
                                  <Accordion type="single" collapsible className="space-y-2">
                                    {Object.entries(commandOutputs).map(([command, output]) => (
                                      <AccordionItem
                                        key={command}
                                        value={`cmd-${command}`}
                                        className="border rounded"
                                      >
                                        <AccordionTrigger className="px-3 py-2 hover:bg-gray-50 text-sm hover:no-underline">
                                          <code className="font-mono text-xs text-left">
                                            {command}
                                          </code>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-3 pb-3">
                                          {renderCommandOutput(output)}
                                        </AccordionContent>
                                      </AccordionItem>
                                    ))}
                                  </Accordion>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 italic">No command output available</p>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No results available for this snapshot
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Failed to load snapshot details
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
