'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Terminal, ChevronDown, ChevronUp, Key } from 'lucide-react'
import { useCredentialsQuery } from '../hooks/use-credentials-query'
import type { SSHCredential } from '../types/templates'

const EMPTY_ARRAY: SSHCredential[] = []

interface PreRunCommandPanelProps {
  command: string
  onCommandChange: (command: string) => void
  credentialId: number | null
  onCredentialChange: (id: number | null) => void
}

export function PreRunCommandPanel({
  command,
  onCommandChange,
  credentialId,
  onCredentialChange,
}: PreRunCommandPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!!command)
  const { data: credentials = EMPTY_ARRAY } = useCredentialsQuery({ type: 'ssh' })

  return (
    <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 py-2 px-4 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Terminal className="h-4 w-4 text-slate-600" />
          <span className="text-sm font-medium">Run before Template (Optional)</span>
          {command.trim() && (
            <Badge variant="secondary" className="ml-2 bg-slate-300 text-slate-700 text-xs">
              Command set
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 hidden sm:inline">
            Execute a command and use output in template
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="p-4 bg-slate-50 space-y-4 border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Run a command on the device before rendering. The output is available as{' '}
            <code className="bg-slate-200 px-1 rounded text-slate-800">{'{{ pre_run_output }}'}</code> (raw) and{' '}
            <code className="bg-slate-200 px-1 rounded text-slate-800">{'{{ pre_run_parsed }}'}</code> (TextFSM parsed).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pre-run-command">Command</Label>
              <Input
                id="pre-run-command"
                placeholder="e.g., show interfaces status"
                value={command}
                onChange={(e) => onCommandChange(e.target.value)}
                className="border-2 border-slate-300 bg-white focus:border-slate-500 focus:ring-2 focus:ring-slate-200 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pre-run-credential">Credentials {command.trim() && '*'}</Label>
              <Select
                value={credentialId?.toString() ?? 'none'}
                onValueChange={(value) => onCredentialChange(value && value !== 'none' ? parseInt(value, 10) : null)}
              >
                <SelectTrigger className={`border-2 bg-white shadow-sm ${command.trim() ? 'border-slate-400' : 'border-slate-300'} focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}>
                  <SelectValue placeholder="Select credentials..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {credentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Key className="h-3 w-3 text-slate-600" />
                        {cred.name} ({cred.username})
                      </div>
                    </SelectItem>
                  ))}
                  {credentials.length === 0 && (
                    <div className="px-2 py-1 text-sm text-gray-500">No SSH credentials found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          {command.trim() && !credentialId && (
            <p className="text-xs text-slate-600">
              Credentials required to execute pre-run command
            </p>
          )}
        </div>
      )}
    </div>
  )
}
