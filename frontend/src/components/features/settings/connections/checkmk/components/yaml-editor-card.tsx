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
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
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
              className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
              title="Show help and examples"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Configuration Content</Label>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="YAML content will be loaded here..."
            className="w-full h-96 font-mono text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">{description}</p>
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
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
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
