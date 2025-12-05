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
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Variable, 
  FileCode, 
  Copy, 
  Check,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'
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
  // Error data
  error_title?: string
  error_message?: string
  error_details?: string[]
}

function ContextDataViewer({ data, label, depth = 0 }: { data: unknown; label: string; depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)

  if (data === null || data === undefined) {
    return (
      <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
        <span className="text-slate-600 font-medium text-sm">{label}:</span>
        <span className="text-slate-400 italic text-sm">null</span>
      </div>
    )
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) {
      return (
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
          <span className="text-slate-600 font-medium text-sm">{label}:</span>
          <span className="text-slate-400 italic text-sm">{'{}'}</span>
        </div>
      )
    }
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 py-1 hover:bg-slate-100 rounded w-full text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-slate-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-slate-400" />
          )}
          <span className="text-slate-600 font-medium text-sm">{label}</span>
          <span className="text-slate-400 text-xs">({entries.length} items)</span>
        </button>
        {isExpanded && (
          <div className="border-l border-slate-200 ml-1.5">
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
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
          <span className="text-slate-600 font-medium text-sm">{label}:</span>
          <span className="text-slate-400 italic text-sm">[]</span>
        </div>
      )
    }
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 py-1 hover:bg-slate-100 rounded w-full text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-slate-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-slate-400" />
          )}
          <span className="text-slate-600 font-medium text-sm">{label}</span>
          <span className="text-slate-400 text-xs">[{data.length} items]</span>
        </button>
        {isExpanded && (
          <div className="border-l border-slate-200 ml-1.5">
            {data.map((item, index) => {
              // eslint-disable-next-line react/no-array-index-key
              return <ContextDataViewer key={`${label}-item-${index}`} data={item} label={`[${index}]`} depth={depth + 1} />
            })}
          </div>
        )}
      </div>
    )
  }

  // Primitive values
  const displayValue = typeof data === 'string' ? `"${data}"` : String(data)
  const valueClass = 
    typeof data === 'string' ? 'text-green-600' :
    typeof data === 'number' ? 'text-blue-600' :
    typeof data === 'boolean' ? 'text-purple-600' :
    'text-slate-600'

  return (
    <div className="flex items-start gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
      <span className="text-slate-600 font-medium text-sm flex-shrink-0">{label}:</span>
      <span className={cn('text-sm break-all', valueClass)}>{displayValue}</span>
    </div>
  )
}

export function TemplateRenderResultDialog({ open, onOpenChange, result }: TemplateRenderResultDialogProps) {
  const [copied, setCopied] = useState(false)

  if (!result) return null

  const handleCopy = async () => {
    if (result.rendered_content) {
      await navigator.clipboard.writeText(result.rendered_content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[90vw] w-[1400px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className={cn(
            "flex items-center gap-2 text-lg",
            result.success ? "text-green-700" : "text-red-700"
          )}>
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
              : result.error_message || 'An error occurred while rendering the template'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Warnings banner */}
        {result.success && result.warnings && result.warnings.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">Warnings</p>
              <ul className="text-sm text-amber-700 space-y-0.5">
                {result.warnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-1">
                    <span className="text-amber-500">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Main content - two columns */}
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Left column: Variables & Context */}
          <div className="flex flex-col space-y-4 min-h-0 overflow-hidden">
            {/* Variables used */}
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Variable className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-semibold text-slate-700">Variables Used</Label>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg min-h-[60px]">
                {result.variables_used && result.variables_used.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {result.variables_used.map((variable) => (
                      <Badge 
                        key={variable} 
                        variant="secondary" 
                        className="font-mono text-xs bg-blue-100 text-blue-700 border border-blue-200"
                      >
                        {variable}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No variables detected in template</p>
                )}
              </div>
            </div>

            {/* Context data (collapsible tree view) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <FileCode className="h-4 w-4 text-purple-600" />
                <Label className="text-sm font-semibold text-slate-700">Context Data</Label>
              </div>
              <div className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-y-auto min-h-[200px] max-h-[500px]">
                {result.context_data ? (
                  <div className="text-sm font-mono">
                    {Object.entries(result.context_data).map(([key, value]) => (
                      <ContextDataViewer key={key} data={value} label={key} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No context data available</p>
                )}
              </div>
            </div>
          </div>

          {/* Right column: Rendered content or Error details */}
          <div className="flex flex-col min-h-0 overflow-hidden">
            {result.success ? (
              <>
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-green-600" />
                    <Label className="text-sm font-semibold text-slate-700">Rendered Output</Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-green-600" />
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
                  className="flex-1 font-mono text-sm border-2 border-green-200 bg-green-50 resize-none min-h-[200px] max-h-[500px]"
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <Label className="text-sm font-semibold text-slate-700">Error Details</Label>
                </div>
                <div className="flex-1 p-4 bg-red-50 border-2 border-red-200 rounded-lg space-y-4 overflow-y-auto min-h-[200px] max-h-[500px]">
                  {/* Error message */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-red-800">Error Message:</p>
                    <div className="p-3 bg-white border border-red-200 rounded font-mono text-sm text-red-700 whitespace-pre-wrap">
                      {result.error_message || 'Unknown error'}
                    </div>
                  </div>

                  {/* Error details list */}
                  {result.error_details && result.error_details.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-red-800">Details:</p>
                      <ul className="space-y-1">
                        {result.error_details.map((detail) => (
                          <li key={detail} className="flex items-start gap-2 text-sm text-red-700">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span className="font-mono">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Debugging tips */}
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-blue-800 mb-2">Debugging Tips:</p>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span>Check that all variables in your template are defined</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span>Ensure Jinja2 syntax is correct (e.g., <code className="bg-blue-100 px-1 rounded">{'{{ variable }}'}</code>)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span>For Nautobot data, access via <code className="bg-blue-100 px-1 rounded">nautobot.field_name</code></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span>User variables are accessed via <code className="bg-blue-100 px-1 rounded">user_variables.var_name</code></span>
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
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
