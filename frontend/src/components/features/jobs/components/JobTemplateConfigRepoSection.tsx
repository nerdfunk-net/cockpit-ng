import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FolderGit2 } from "lucide-react"

interface GitRepository {
  id: number
  name: string
  url: string
  branch: string
  category: string
}

interface JobTemplateConfigRepoSectionProps {
  formConfigRepoId: number | null
  setFormConfigRepoId: (value: number | null) => void
  configRepos: GitRepository[]
}

export function JobTemplateConfigRepoSection({
  formConfigRepoId,
  setFormConfigRepoId,
  configRepos,
}: JobTemplateConfigRepoSectionProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FolderGit2 className="h-4 w-4 text-slate-600" />
        <Label className="text-sm font-semibold text-slate-700">Configuration Repository</Label>
        <span className="text-xs text-slate-500">(Optional)</span>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="config-repo" className="text-xs text-slate-600">Git Repository (category=Device Configs)</Label>
        <Select
          value={formConfigRepoId?.toString() || "none"}
          onValueChange={(v) => setFormConfigRepoId(v === "none" ? null : parseInt(v))}
        >
          <SelectTrigger id="config-repo" className="h-9 bg-white border-2 border-gray-400 shadow-sm">
            <SelectValue placeholder="Select config repository (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {configRepos.map((repo) => (
              <SelectItem key={repo.id} value={repo.id.toString()}>
                {repo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          Select a Git repository with configuration files
        </p>
      </div>
    </div>
  )
}
