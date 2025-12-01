import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HardDrive, Globe, FileText, Loader2 } from "lucide-react"

interface GitRepository {
  id: number
  name: string
  url: string
  branch: string
  category: string
}

interface SavedInventory {
  name: string
  description?: string
}

interface JobTemplateInventorySectionProps {
  formInventorySource: "all" | "inventory"
  setFormInventorySource: (value: "all" | "inventory") => void
  formInventoryRepoId: number | null
  setFormInventoryRepoId: (value: number | null) => void
  formInventoryName: string
  setFormInventoryName: (value: string) => void
  inventoryRepos: GitRepository[]
  savedInventories: SavedInventory[]
  loadingInventories: boolean
  onInventoryRepoChange: (repoId: number) => void
}

export function JobTemplateInventorySection({
  formInventorySource,
  setFormInventorySource,
  formInventoryRepoId,
  setFormInventoryRepoId,
  formInventoryName,
  setFormInventoryName,
  inventoryRepos,
  savedInventories,
  loadingInventories,
  onInventoryRepoChange,
}: JobTemplateInventorySectionProps) {
  const handleRepoChange = (v: string) => {
    const repoId = parseInt(v)
    setFormInventoryRepoId(repoId)
    setFormInventoryName("")
    onInventoryRepoChange(repoId)
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-emerald-600" />
        <Label className="text-sm font-semibold text-emerald-900">Inventory</Label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="inventory-source" className="text-xs text-emerald-700">Source</Label>
          <Select
            value={formInventorySource}
            onValueChange={(v) => setFormInventorySource(v as "all" | "inventory")}
          >
            <SelectTrigger id="inventory-source" className="h-9 bg-white border-emerald-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span>All Devices</span>
                </div>
              </SelectItem>
              <SelectItem value="inventory">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  <span>Use Inventory</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inventory-repo" className="text-xs text-emerald-700">
            Repository {formInventorySource === "inventory" && <span className="text-red-500">*</span>}
          </Label>
          <Select
            value={formInventoryRepoId?.toString() || ""}
            onValueChange={handleRepoChange}
            disabled={formInventorySource === "all"}
          >
            <SelectTrigger id="inventory-repo" className="h-9 bg-white border-emerald-200 disabled:opacity-50">
              <SelectValue placeholder="Select repository" />
            </SelectTrigger>
            <SelectContent>
              {inventoryRepos.map((repo) => (
                <SelectItem key={repo.id} value={repo.id.toString()}>
                  {repo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inventory-name" className="text-xs text-emerald-700">
            Inventory {formInventorySource === "inventory" && <span className="text-red-500">*</span>}
          </Label>
          {loadingInventories ? (
            <div className="flex items-center justify-center h-9 bg-white border border-emerald-200 rounded-md">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
            </div>
          ) : (
            <Select
              value={formInventoryName}
              onValueChange={setFormInventoryName}
              disabled={formInventorySource === "all" || !formInventoryRepoId}
            >
              <SelectTrigger id="inventory-name" className="h-9 bg-white border-emerald-200 disabled:opacity-50">
                <SelectValue placeholder="Select inventory" />
              </SelectTrigger>
              <SelectContent>
                {savedInventories.map((inv) => (
                  <SelectItem key={inv.name} value={inv.name}>
                    {inv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  )
}
