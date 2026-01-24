'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useCheckmkPendingChangesQuery, useCheckmkChangesMutations, useCheckmkActivationStatusQuery } from '../hooks/queries/use-checkmk-changes-query'
import { ActivationStatusCard } from '../components/activation-status-card'

export function ChangesTab() {
  const [activationId, setActivationId] = useState<string | null>(null)
  const { data, isLoading, refetch, error, isFetching } = useCheckmkPendingChangesQuery()
  const { activateAllChanges, activateChangesWithEtag } = useCheckmkChangesMutations((id) => setActivationId(id))
  const { data: activationStatus, isLoading: isLoadingStatus } = useCheckmkActivationStatusQuery(activationId, {
    enabled: !!activationId
  })

  const changes = data?.data?.value || []
  const etag = data?.data?.etag || ''
  const hasChanges = changes.length > 0

  const handleGetPendingChanges = () => {
    refetch()
  }

  const handleActivateAll = () => {
    activateAllChanges.mutate()
  }

  const handleActivateWithEtag = () => {
    if (etag) {
      activateChangesWithEtag.mutate({ etag })
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="space-y-6">
      {/* Actions Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm font-medium">Change Management</span>
          </div>
          <div className="text-xs text-blue-100">
            Manage pending configuration changes
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleGetPendingChanges}
                disabled={isFetching}
                variant="default"
              >
                {isFetching && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                )}
                {isFetching ? 'Loading...' : 'Get Pending Changes'}
              </Button>
              <Button
                onClick={handleActivateAll}
                disabled={activateAllChanges.isPending}
                variant="outline"
              >
                {activateAllChanges.isPending && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2" />
                )}
                Activate All Changes
              </Button>
            </div>

            {/* Error Display */}
            {error && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error instanceof Error ? error.message : 'Failed to fetch pending changes'}
                </AlertDescription>
              </Alert>
            )}

            {/* No Changes Message */}
            {!isLoading && !error && !hasChanges && data && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  No pending changes. All configurations are up to date.
                </AlertDescription>
              </Alert>
            )}

            {/* Pending Changes Display */}
            {hasChanges && (
              <div className="space-y-4">
                {/* Summary Bar */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-800">
                      <strong>{changes.length}</strong> pending change{changes.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                  {etag && (
                    <Button
                      size="sm"
                      onClick={handleActivateWithEtag}
                      disabled={activateChangesWithEtag.isPending}
                    >
                      {activateChangesWithEtag.isPending && (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                      )}
                      Activate These Changes
                    </Button>
                  )}
                </div>

                {/* Changes List */}
                <div className="space-y-3">
                  {changes.map((change) => (
                    <div
                      key={change.id}
                      className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                              {change.action_name}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              by {change.user_id}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 font-medium">
                            {change.text}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>ID: {change.id}</span>
                            <span>•</span>
                            <span>{formatDate(change.time)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ETag Display */}
                {etag && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-xs text-gray-600">
                      <strong>ETag:</strong> <code className="font-mono">{etag}</code>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activation Status Display */}
      {activationStatus && (
        <ActivationStatusCard data={activationStatus} isLoading={isLoadingStatus} />
      )}
    </div>
  )
}
