// Repository Status Dialog Component

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  RefreshCw,
  GitCommit,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  GitBranch,
  Edit,
  Plus,
} from 'lucide-react'
import type { GitStatus } from '../types'

interface RepositoryStatusDialogProps {
  show: boolean
  onClose: () => void
  statusData: GitStatus | null
  isLoading: boolean
}

export function RepositoryStatusDialog({
  show,
  onClose,
  statusData,
  isLoading,
}: RepositoryStatusDialogProps) {
  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Git Repository Status
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {isLoading || !statusData ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Loading repository status...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Repository Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Repository Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Name:</span>
                      <span>{statusData.repository_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Branch:</span>
                      <Badge variant="outline">{statusData.current_branch || statusData.repository_branch}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <div className={`flex items-center gap-2 ${
                        statusData.is_synced ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {statusData.is_synced ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        {statusData.is_synced ? 'Clean working directory' : 'Modified files present'}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">URL:</span>
                      <a
                        href={statusData.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Repository
                      </a>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GitBranch className="h-5 w-5" />
                      Available Branches
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusData.branches && statusData.branches.length > 0 ? (
                      <div className="space-y-2">
                        {statusData.branches.map((branch) => (
                          <div key={branch} className={`flex items-center gap-2 ${
                            branch === statusData.current_branch ? 'text-blue-600 font-medium' : ''
                          }`}>
                            <GitBranch className="h-4 w-4" />
                            {branch}
                            {branch === statusData.current_branch && (
                              <Badge variant="outline" className="text-xs">current</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No branches available</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Working Directory Changes */}
              {(!statusData.is_synced && (statusData.modified_files?.length || statusData.untracked_files?.length || statusData.staged_files?.length)) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Edit className="h-5 w-5" />
                      Working Directory Changes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {statusData.modified_files && statusData.modified_files.length > 0 && (
                      <div>
                        <h6 className="font-medium text-yellow-600 mb-2">Modified Files:</h6>
                        <div className="space-y-1">
                          {statusData.modified_files.map((file) => (
                            <div key={file} className="flex items-center gap-2 text-sm">
                              <Edit className="h-4 w-4 text-yellow-500" />
                              {file}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {statusData.untracked_files && statusData.untracked_files.length > 0 && (
                      <div>
                        <h6 className="font-medium text-blue-600 mb-2">Untracked Files:</h6>
                        <div className="space-y-1">
                          {statusData.untracked_files.map((file) => (
                            <div key={file} className="flex items-center gap-2 text-sm">
                              <Plus className="h-4 w-4 text-blue-500" />
                              {file}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {statusData.staged_files && statusData.staged_files.length > 0 && (
                      <div>
                        <h6 className="font-medium text-green-600 mb-2">Staged Files:</h6>
                        <div className="space-y-1">
                          {statusData.staged_files.map((file) => (
                            <div key={file} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              {file}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recent Commits */}
              {statusData.commits && statusData.commits.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GitCommit className="h-5 w-5" />
                      Recent Commits
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {statusData.commits.slice(0, 10).map((commit) => (
                        <div key={commit.hash} className="border-l-2 border-gray-200 pl-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {commit.hash.substring(0, 8)}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                {commit.author?.name || 'Unknown'}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(commit.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{commit.message}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
