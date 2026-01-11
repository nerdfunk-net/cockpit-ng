// Diagnostics Tab Component for Debug Dialog

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Info, CheckCircle, AlertCircle, Upload } from 'lucide-react'
import type { DebugResult } from '../../types'

interface DiagnosticsTabProps {
  result: DebugResult | null
  isLoading: boolean
  onRun: () => void
}

export function DiagnosticsTab({ result, isLoading, onRun }: DiagnosticsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Repository Diagnostics</CardTitle>
        <CardDescription>
          Comprehensive diagnostic information about repository access, permissions, and configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onRun} disabled={isLoading} className="w-full">
          {isLoading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Info className="h-4 w-4 mr-2" />
          )}
          Run Diagnostics
        </Button>

        {result && (
          <div className="space-y-4">
            <div className={`p-4 rounded-md ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className={`font-medium ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {result.success ? 'Diagnostics Complete' : 'Diagnostics Failed'}
                </span>
              </div>
            </div>

            {result.diagnostics && (
              <div className="space-y-4">
                {/* Repository Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Repository Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(result.diagnostics.repository_info).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium text-gray-700">{key}:</span>
                          <span className="text-gray-900">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Access Test */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Access Test</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(result.diagnostics.access_test).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium text-gray-700">{key}:</span>
                          <span className={
                            key === 'accessible' ? (value ? 'text-green-600' : 'text-red-600') : 'text-gray-900'
                          }>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* File System Permissions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">File System Permissions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(result.diagnostics.file_system).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium text-gray-700">{key}:</span>
                          <span className={
                            typeof value === 'boolean' ? (value ? 'text-green-600' : 'text-red-600') : 'text-gray-900'
                          }>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Git Status */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Git Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(result.diagnostics.git_status).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium text-gray-700">{key}:</span>
                          <span className="text-gray-900">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* SSL Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">SSL/TLS Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(result.diagnostics.ssl_info).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium text-gray-700">{key}:</span>
                          <span className="text-gray-900">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Credentials */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Credentials</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(result.diagnostics.credentials).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium text-gray-700">{key}:</span>
                          <span className={
                            key.startsWith('has_') ? (value ? 'text-green-600' : 'text-red-600') : 'text-gray-900'
                          }>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Push Capability */}
                {result.diagnostics.push_capability && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Push Capability
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-700">Status:</span>
                          <span className={
                            result.diagnostics.push_capability.can_push
                              ? 'text-green-600 font-medium'
                              : 'text-red-600 font-medium'
                          }>
                            {result.diagnostics.push_capability.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Message:</span>
                          <span className="text-gray-900 text-right max-w-[60%]">
                            {result.diagnostics.push_capability.message}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Can Push:</span>
                          <span className={
                            result.diagnostics.push_capability.can_push
                              ? 'text-green-600'
                              : 'text-red-600'
                          }>
                            {String(result.diagnostics.push_capability.can_push)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Has Credentials:</span>
                          <span className={
                            result.diagnostics.push_capability.has_credentials
                              ? 'text-green-600'
                              : 'text-red-600'
                          }>
                            {String(result.diagnostics.push_capability.has_credentials)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Has Remote:</span>
                          <span className={
                            result.diagnostics.push_capability.has_remote
                              ? 'text-green-600'
                              : 'text-red-600'
                          }>
                            {String(result.diagnostics.push_capability.has_remote)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
