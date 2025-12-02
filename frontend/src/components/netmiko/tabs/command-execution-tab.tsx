import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Terminal, Play, XCircle, CheckCircle2, AlertCircle } from 'lucide-react'
import { CredentialSelector } from '../ui/credential-selector'
import { LoadingButton } from '../ui/loading-button'
import type { StoredCredential, Template } from '../types'

interface CommandExecutionTabProps {
  selectedDevices: Array<{ name: string }>
  // Credentials
  storedCredentials: StoredCredential[]
  selectedCredentialId: string
  username: string
  password: string
  onCredentialChange: (credId: string) => void
  onUsernameChange: (username: string) => void
  onPasswordChange: (password: string) => void
  // Commands
  commands: string
  setCommands: (commands: string) => void
  selectedTemplateId: string
  selectedTemplate: Template | null
  // Options
  enableMode: boolean
  setEnableMode: (enabled: boolean) => void
  writeConfig: boolean
  setWriteConfig: (enabled: boolean) => void
  dryRun: boolean
  setDryRun: (enabled: boolean) => void
  // Execution
  isExecuting: boolean
  isCancelling: boolean
  currentSessionId: string | null
  onExecute: () => void
  onCancel: () => void
}

export function CommandExecutionTab({
  selectedDevices,
  storedCredentials,
  selectedCredentialId,
  username,
  password,
  onCredentialChange,
  onUsernameChange,
  onPasswordChange,
  commands,
  setCommands,
  selectedTemplateId,
  selectedTemplate,
  enableMode,
  setEnableMode,
  writeConfig,
  setWriteConfig,
  dryRun,
  setDryRun,
  isExecuting,
  isCancelling,
  currentSessionId,
  onExecute,
  onCancel,
}: CommandExecutionTabProps) {
  const usingTemplate = selectedTemplateId !== 'none'

  return (
    <div className="space-y-6">
      {/* Command Input Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Terminal className="h-4 w-4" />
            <span className="text-sm font-medium">Command Configuration</span>
          </div>
          <div className="text-xs text-blue-100">
            Enter commands to execute on selected devices
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {selectedDevices.length === 0 && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No devices selected. Please select devices in the <strong>Devices</strong> tab first.
              </AlertDescription>
            </Alert>
          )}

          {selectedDevices.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>{selectedDevices.length}</strong> device{selectedDevices.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          <div className="space-y-4">
            {/* Credentials Selection */}
            <CredentialSelector
              storedCredentials={storedCredentials}
              selectedCredentialId={selectedCredentialId}
              username={username}
              password={password}
              onCredentialChange={onCredentialChange}
              onUsernameChange={onUsernameChange}
              onPasswordChange={onPasswordChange}
            />

            {/* Commands Input or Template Info */}
            {!usingTemplate ? (
              <div className="space-y-2">
                <Label htmlFor="commands">Commands (one per line) *</Label>
                <Textarea
                  id="commands"
                  placeholder="Enter commands, one per line. Example:&#10;show version&#10;show ip interface brief&#10;show running-config"
                  value={commands}
                  onChange={(e) => setCommands(e.target.value)}
                  rows={8}
                  className="font-mono text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
                <p className="text-xs text-gray-500">
                  Tip: Enter one command per line. Commands will be executed in sequence.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-md space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  <Label className="text-blue-900 font-semibold">Using Template</Label>
                </div>
                <p className="text-sm text-blue-800">
                  Commands will be generated from the selected template: <strong>{selectedTemplate?.name}</strong>
                </p>
                <p className="text-xs text-blue-700">
                  The template will be rendered for each device using Nautobot context and your defined variables.
                </p>
              </div>
            )}

            {/* Enable Mode Toggle */}
            <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm">
              <Switch
                id="enable-mode"
                checked={enableMode}
                onCheckedChange={setEnableMode}
                className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-400 border-2 border-slate-300"
              />
              <div className="flex-1">
                <Label htmlFor="enable-mode" className="font-medium text-slate-800 cursor-pointer">
                  Enable configure mode after login
                </Label>
                <p className="text-xs text-slate-600 mt-1">
                  When enabled, commands will be executed in configuration mode
                </p>
              </div>
            </div>

            {/* Write Config Toggle */}
            <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm">
              <Switch
                id="write-config"
                checked={writeConfig}
                onCheckedChange={setWriteConfig}
                className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-slate-400 border-2 border-slate-300"
              />
              <div className="flex-1">
                <Label htmlFor="write-config" className="font-medium text-slate-800 cursor-pointer">
                  Write config at the end (when no errors occurred)
                </Label>
                <p className="text-xs text-slate-600 mt-1">
                  When enabled, runs &quot;copy running-config startup-config&quot; after successful command execution
                </p>
              </div>
            </div>

            {/* Dry Run Toggle (only for templates) */}
            {usingTemplate && (
              <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-lg shadow-sm">
                <Switch
                  id="dry-run"
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                  className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-slate-400 border-2 border-amber-300"
                />
                <div className="flex-1">
                  <Label htmlFor="dry-run" className="font-medium cursor-pointer text-amber-900">
                    Dry Run (render only, do not execute)
                  </Label>
                  <p className="text-xs text-amber-700 mt-1">
                    When enabled, the template will be rendered for each device but NOT executed. Use this to preview generated commands.
                  </p>
                </div>
              </div>
            )}

            {/* Execute and Cancel Buttons */}
            <div className="flex justify-start gap-3 pt-2">
              <LoadingButton
                isLoading={isExecuting}
                onClick={onExecute}
                disabled={
                  selectedDevices.length === 0 ||
                  (!usingTemplate && !commands.trim()) ||
                  (!usingTemplate && (!username.trim() || !password.trim())) ||
                  (usingTemplate && !dryRun && (!username.trim() || !password.trim()))
                }
                loadingText="Executing..."
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white border-0 px-6"
                size="lg"
                icon={<Play className="h-5 w-5" />}
              >
                {usingTemplate
                  ? (dryRun ? 'Render Template (Dry Run)' : 'Execute Template')
                  : 'Run Commands'}
              </LoadingButton>

              {isExecuting && currentSessionId && (
                <Button
                  onClick={onCancel}
                  disabled={isCancelling}
                  className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white border-0 px-6"
                  size="lg"
                >
                  <XCircle className="h-5 w-5" />
                  <span>{isCancelling ? 'Cancelling...' : 'Cancel'}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
