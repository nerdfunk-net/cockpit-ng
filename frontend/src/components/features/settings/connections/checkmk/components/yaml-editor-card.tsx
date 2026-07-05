import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, CheckCircle, RotateCcw, FileText, HelpCircle } from 'lucide-react'

interface YamlEditorCardProps {
  title: string
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onValidate: () => void
  onReload: () => void
  isLoading?: boolean
  isValidating?: boolean
  isSaving?: boolean
  showHelp?: boolean
  onHelpClick?: () => void
  description?: string
}

export function YamlEditorCard({
  title,
  value,
  onChange,
  onSave,
  onValidate,
  onReload,
  isLoading = false,
  isValidating = false,
  isSaving = false,
  showHelp = false,
  onHelpClick,
  description = 'Edit the YAML configuration file.',
}: YamlEditorCardProps) {
  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="panel-header border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            <span>{title}</span>
          </div>
          {showHelp && onHelpClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onHelpClick}
              className="h-7 w-7 p-0 hover:bg-panel-header-foreground/20"
              title="Show help and examples"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="panel-content p-6 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Configuration Content
          </Label>
          <Textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="YAML content will be loaded here..."
            className="w-full h-96 font-mono text-sm border-border focus:border-ring focus:ring-ring"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onReload}
            disabled={isLoading || isValidating || isSaving}
            className="flex items-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            <span>Reload</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onValidate}
            disabled={isLoading || isValidating || isSaving || !value}
            className="flex items-center space-x-2"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <span>Check YAML</span>
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isLoading || isValidating || isSaving}
            className="flex items-center space-x-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span>Save Configuration</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
