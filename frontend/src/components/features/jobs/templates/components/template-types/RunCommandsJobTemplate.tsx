import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Terminal } from 'lucide-react'

interface CommandTemplate {
  id: number
  name: string
  category: string
}

interface RunCommandsJobTemplateProps {
  formCommandTemplate: string
  setFormCommandTemplate: (value: string) => void
  commandTemplates: CommandTemplate[]
}

export function RunCommandsJobTemplate({
  formCommandTemplate,
  setFormCommandTemplate,
  commandTemplates,
}: RunCommandsJobTemplateProps) {
  return (
    <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-info-foreground" />
        <Label className="text-sm font-semibold text-info-foreground">
          Command Template
        </Label>
      </div>
      <Select value={formCommandTemplate} onValueChange={setFormCommandTemplate}>
        <SelectTrigger className="h-9 bg-card border-info-border">
          <SelectValue placeholder="Select command template" />
        </SelectTrigger>
        <SelectContent>
          {commandTemplates.map(template => (
            <SelectItem key={template.id} value={template.name}>
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span>{template.name}</span>
                {template.category && (
                  <Badge variant="secondary" className="text-xs">
                    {template.category}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-info-foreground">
        Templates can be created in Network / Automation / Templates
      </p>
    </div>
  )
}
