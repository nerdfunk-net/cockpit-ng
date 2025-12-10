import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Terminal } from "lucide-react"

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
    <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-violet-600" />
        <Label className="text-sm font-semibold text-violet-900">Command Template</Label>
      </div>
      <Select
        value={formCommandTemplate}
        onValueChange={setFormCommandTemplate}
      >
        <SelectTrigger className="h-9 bg-white border-violet-200">
          <SelectValue placeholder="Select command template" />
        </SelectTrigger>
        <SelectContent>
          {commandTemplates.map((template) => (
            <SelectItem key={template.id} value={template.name}>
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-gray-500" />
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
      <p className="text-xs text-violet-600">
        Templates can be created in Network / Automation / Templates
      </p>
    </div>
  )
}
