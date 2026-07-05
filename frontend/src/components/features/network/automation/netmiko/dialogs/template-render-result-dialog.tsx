import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { StatusAlert } from '@/components/shared/status-alert'
import {
  CheckCircle,
  XCircle,
  Variable,
  FileCode,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Terminal,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

interface TemplateRenderResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: TemplateRenderResult | null
}

export interface TemplateRenderResult {
  success: boolean
  // Success data
  rendered_content?: string
  variables_used?: string[]
  context_data?: Record<string, unknown>
  warnings?: string[]
  // Pre-run command data (also available in context_data but exposed separately for convenience)
  pre_run_output?: string
  pre_run_parsed?: Array<Record<string, unknown>>
  // Error data
  error_title?: string
  error_message?: string
  error_details?: string[]
}

function ContextDataViewer({
  data,
  label,
  depth = 0,
}: {
  data: unknown
  label: string
  depth?: number
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)

  const arrayItemKeys = useMemo(
    () => (Array.isArray(data) ? data.map(() => crypto.randomUUID()) : []),
    [data]
  )

  if (data === null || data === undefined) {
    return (
      <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
        <span className="text-muted-foreground font-medium text-sm">{label}:</span>
        <span className="text-muted-foreground italic text-sm">null</span>
      </div>
    )
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) {
      return (
        <div
          className="flex items-center gap-2 py-1"
          style={{ paddingLeft: depth * 16 }}
        >
          <span className="text-muted-foreground font-medium text-sm">{label}:</span>
          <span className="text-muted-foreground italic text-sm">{'{}'}</span>
        </div>
      )
    }
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 py-1 hover:bg-muted rounded w-full text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-muted-foreground font-medium text-sm">{label}</span>
          <span className="text-muted-foreground text-xs">({entries.length} items)</span>
        </button>
        {isExpanded && (
          <div className="border-l border-border ml-1.5">
            {entries.map(([key, value]) => (
              <ContextDataViewer key={key} data={value} label={key} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div
          className="flex items-center gap-2 py-1"
          style={{ paddingLeft: depth * 16 }}
        >
          <span className="text-muted-foreground font-medium text-sm">{label}:</span>
          <span className="text-muted-foreground italic text-sm">[]</span>
        </div>
      )
    }
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 py-1 hover:bg-muted rounded w-full text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-muted-foreground font-medium text-sm">{label}</span>
          <span className="text-muted-foreground text-xs">[{data.length} items]</span>
        </button>
        {isExpanded && (
          <div className="border-l border-border ml-1.5">
            {data.map((item, index) => (
              <ContextDataViewer
                key={arrayItemKeys[index]}
                data={item}
                label={`[${index}]`}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Primitive values
  const displayValue = typeof data === 'string' ? `"${data}"` : String(data)

  return (
    <div className="flex items-start gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
      <span className="text-muted-foreground font-medium text-sm flex-shrink-0">
        {label}:
      </span>
      <span className="text-sm break-all text-foreground">{displayValue}</span>
    </div>
  )
}

export function TemplateRenderResultDialog({
  open,
  onOpenChange,
  result,
}: TemplateRenderResultDialogProps) {
  const [copied, setCopied] = useState(false)
  const [copiedParsed, setCopiedParsed] = useState(false)
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [activeContextTab, setActiveContextTab] = useState<'nautobot' | 'prerun'>(
    'nautobot'
  )

  if (!result) return null

  // Extract context data with proper typing
  const nautobotContext = result.context_data?.nautobot as
    | Record<string, unknown>
    | undefined
  const preRunOutput = result.context_data?.pre_run_output as string | undefined
  const preRunParsed = result.context_data?.pre_run_parsed as
    | Array<Record<string, unknown>>
    | undefined
  const userVariables = result.context_data?.user_variables as
    | Record<string, unknown>
    | undefined
  const hasPreRunData = Boolean(
    preRunOutput || (preRunParsed && preRunParsed.length > 0)
  )

  const handleCopy = async () => {
    if (result.rendered_content) {
      await navigator.clipboard.writeText(result.rendered_content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCopyParsed = async () => {
    if (preRunParsed) {
      await navigator.clipboard.writeText(JSON.stringify(preRunParsed, null, 2))
      setCopiedParsed(true)
      setTimeout(() => setCopiedParsed(false), 2000)
    }
  }

  const handleCopyRaw = async () => {
    if (preRunOutput) {
      await navigator.clipboard.writeText(preRunOutput)
      setCopiedRaw(true)
      setTimeout(() => setCopiedRaw(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[90vw] w-[1400px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle
            className={cn(
              'flex items-center gap-2 text-lg',
              result.success ? 'text-success-foreground' : 'text-error-foreground'
            )}
          >
            {result.success ? (
              <>
                <CheckCircle className="h-5 w-5" />
                Template Rendered Successfully
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5" />
                {result.error_title || 'Template Rendering Failed'}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {result.success
              ? 'Review the rendered output and variables used'
              : result.error_message ||
                'An error occurred while rendering the template'}
          </DialogDescription>
        </DialogHeader>

        {/* Warnings banner */}
        {result.success && result.warnings && result.warnings.length > 0 && (
          <StatusAlert variant="warning">
            <p className="text-sm font-medium mb-1">Warnings</p>
            <ul className="text-sm space-y-0.5">
              {result.warnings.map(warning => (
                <li key={warning} className="flex items-start gap-1">
                  <span>•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </StatusAlert>
        )}

        {/* Main content - two columns */}
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Left column: Variables & Context */}
          <div className="flex flex-col space-y-4 min-h-0 overflow-hidden">
            {/* Variables used */}
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Variable className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold text-foreground">
                  Variables Used
                </Label>
              </div>
              <div className="p-3 bg-muted border border-border rounded-lg min-h-[60px]">
                {result.variables_used && result.variables_used.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.variables_used.map(variable => (
                      <Badge
                        key={variable}
                        variant="secondary"
                        className="font-mono text-xs bg-info text-info-foreground border border-info-border"
                      >
                        {variable}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No variables detected in template
                  </p>
                )}
              </div>
            </div>

            {/* Context data with tabs for Nautobot and Pre-run */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <FileCode className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold text-foreground">
                  Context Data
                </Label>
              </div>

              {/* Tab buttons */}
              <div className="flex gap-1 mb-2 flex-shrink-0">
                <button
                  onClick={() => setActiveContextTab('nautobot')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg border-2 border-b-0 transition-colors',
                    activeContextTab === 'nautobot'
                      ? 'bg-info border-info-border text-info-foreground'
                      : 'bg-muted border-border text-muted-foreground hover:bg-muted/70'
                  )}
                >
                  <Database className="h-3.5 w-3.5" />
                  Nautobot Context
                </button>
                <button
                  onClick={() => setActiveContextTab('prerun')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg border-2 border-b-0 transition-colors',
                    activeContextTab === 'prerun'
                      ? 'bg-warning border-warning-border text-warning-foreground'
                      : 'bg-muted border-border text-muted-foreground hover:bg-muted/70',
                    // Show indicator if pre-run data exists
                    hasPreRunData ? '' : 'opacity-50'
                  )}
                  disabled={!hasPreRunData}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Pre-run Output
                  {hasPreRunData && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-4 px-1 text-[10px] bg-warning text-warning-foreground"
                    >
                      ✓
                    </Badge>
                  )}
                </button>
              </div>

              {/* Tab content */}
              <div
                className={cn(
                  'flex-1 p-3 border-2 rounded-lg overflow-y-auto min-h-[200px] max-h-[500px]',
                  activeContextTab === 'nautobot'
                    ? 'bg-info border-info-border'
                    : 'bg-warning border-warning-border'
                )}
              >
                {activeContextTab === 'nautobot' ? (
                  // Nautobot context tab
                  nautobotContext ? (
                    <div className="text-sm font-mono">
                      <ContextDataViewer data={nautobotContext} label="nautobot" />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No Nautobot context data available
                    </p>
                  )
                ) : (
                  // Pre-run output tab
                  <div className="space-y-4">
                    {/* Parsed output (structured data) */}
                    {preRunParsed && preRunParsed.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="bg-success text-success-foreground border border-success-border"
                            >
                              TextFSM Parsed
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {preRunParsed.length} record(s)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyParsed}
                            className="h-6 text-xs"
                          >
                            {copiedParsed ? (
                              <>
                                <Check className="h-3 w-3 mr-1 text-success-foreground" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="text-sm font-mono bg-card p-2 rounded border border-warning-border">
                          <ContextDataViewer
                            data={preRunParsed}
                            label="pre_run_parsed"
                          />
                        </div>
                      </div>
                    )}

                    {/* Raw output */}
                    {preRunOutput && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="bg-muted text-muted-foreground border border-border"
                            >
                              Raw Output
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Access via{' '}
                              <code className="bg-muted px-1 rounded">
                                {'{{ pre_run_output }}'}
                              </code>
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyRaw}
                            className="h-6 text-xs"
                          >
                            {copiedRaw ? (
                              <>
                                <Check className="h-3 w-3 mr-1 text-success-foreground" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="text-xs font-mono bg-card p-3 rounded border border-warning-border overflow-x-auto whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                          {preRunOutput}
                        </pre>
                      </div>
                    )}

                    {/* No pre-run data message */}
                    {!hasPreRunData && (
                      <p className="text-sm text-muted-foreground italic">
                        No pre-run command was executed. Use the &quot;Run before
                        Template&quot; panel to execute a command before rendering.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* User variables section */}
              {userVariables && Object.keys(userVariables).length > 0 && (
                <div className="mt-3 p-2 bg-muted border border-border rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">
                    User Variables:
                  </div>
                  <div className="text-sm font-mono">
                    <ContextDataViewer data={userVariables} label="user_variables" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column: Rendered content or Error details */}
          <div className="flex flex-col min-h-0 overflow-hidden">
            {result.success ? (
              <>
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-success-foreground" />
                    <Label className="text-sm font-semibold text-foreground">
                      Rendered Output
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-success-foreground" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={result.rendered_content || ''}
                  readOnly
                  className="flex-1 font-mono text-sm border-2 border-success-border bg-success resize-none min-h-[200px] max-h-[500px]"
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                  <XCircle className="h-4 w-4 text-error-foreground" />
                  <Label className="text-sm font-semibold text-foreground">
                    Error Details
                  </Label>
                </div>
                <div className="flex-1 p-4 bg-error border-2 border-error-border rounded-lg space-y-4 overflow-y-auto min-h-[200px] max-h-[500px]">
                  {/* Error message */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-error-foreground">
                      Error Message:
                    </p>
                    <div className="p-3 bg-card border border-error-border rounded font-mono text-sm text-error-foreground whitespace-pre-wrap">
                      {result.error_message || 'Unknown error'}
                    </div>
                  </div>

                  {/* Error details list */}
                  {result.error_details && result.error_details.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-error-foreground">
                        Details:
                      </p>
                      <ul className="space-y-1">
                        {result.error_details.map(detail => (
                          <li
                            key={detail}
                            className="flex items-start gap-2 text-sm text-error-foreground"
                          >
                            <span className="mt-0.5">•</span>
                            <span className="font-mono">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Debugging tips */}
                  <div className="mt-4 p-3 bg-info border border-info-border rounded-lg">
                    <p className="text-sm font-semibold text-info-foreground mb-2">
                      Debugging Tips:
                    </p>
                    <ul className="space-y-1 text-sm text-info-foreground">
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>
                          Check that all variables in your template are defined
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>
                          Ensure Jinja2 syntax is correct (e.g.,{' '}
                          <code className="bg-info-border/30 px-1 rounded">
                            {'{{ variable }}'}
                          </code>
                          )
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>
                          For Nautobot data, access via{' '}
                          <code className="bg-info-border/30 px-1 rounded">
                            nautobot.field_name
                          </code>
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>
                          User variables are accessed via{' '}
                          <code className="bg-info-border/30 px-1 rounded">
                            user_variables.var_name
                          </code>
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
