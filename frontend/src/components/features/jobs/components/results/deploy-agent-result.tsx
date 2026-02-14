"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CheckCircle2,
  XCircle,
  GitBranch,
  Bot,
  FileCode,
  Clock,
} from "lucide-react"
import { DeployAgentJobResult } from "../../types/job-results"

interface DeployAgentResultViewProps {
  result: DeployAgentJobResult
}

export function DeployAgentResultView({ result }: DeployAgentResultViewProps) {
  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
          <p className={`text-lg font-semibold ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.success ? 'Success' : 'Failed'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Files Changed</p>
          <p className="text-lg font-semibold text-gray-700">{String(result.files_changed ?? 0)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pushed</p>
          <Badge variant={result.pushed ? "default" : "secondary"} className="mt-1">
            {result.pushed ? 'Yes' : 'No'}
          </Badge>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Commit</p>
          <p className="text-lg font-mono font-semibold text-gray-700">
            {result.commit_sha_short || 'N/A'}
          </p>
        </div>
      </div>

      {/* Message */}
      {result.message && (
        <div className={`border rounded-lg p-3 flex items-start gap-2 ${
          result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          {result.success ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
            {String(result.message)}
          </p>
        </div>
      )}

      {/* Git Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-blue-500" />
            Git Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Repository</span>
              <span className="text-gray-900">{result.repository_name}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Branch</span>
              <Badge variant="outline">{result.branch}</Badge>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Commit SHA</span>
              <span className="text-gray-900 font-mono text-xs">{result.commit_sha || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Files Changed</span>
              <span className="text-gray-900">{String(result.files_changed ?? 0)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-gray-600">Pushed to Remote</span>
              <Badge variant={result.pushed ? "default" : "secondary"}>
                {result.pushed ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent & Template Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-teal-500" />
            Deployment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Agent</span>
              <span className="text-gray-900">{result.agent_name}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-600">Template</span>
              <span className="text-gray-900">{result.template_name}</span>
            </div>
            <div className="flex justify-between py-2 border-b items-center">
              <span className="font-medium text-gray-600 flex items-center gap-1">
                <FileCode className="h-3.5 w-3.5" />
                File Path
              </span>
              <span className="text-gray-900 font-mono text-xs">{result.file_path}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-gray-600 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Timestamp
              </span>
              <span className="text-gray-900">{result.timestamp}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
