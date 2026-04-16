import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Database, Zap } from 'lucide-react'

interface GetClientDataJobTemplateProps {
  collectIpAddress: boolean
  setCollectIpAddress: (value: boolean) => void
  collectMacAddress: boolean
  setCollectMacAddress: (value: boolean) => void
  collectHostname: boolean
  setCollectHostname: (value: boolean) => void
  parallelTasks: number
  setParallelTasks: (value: number) => void
}

export function GetClientDataJobTemplate({
  collectIpAddress,
  setCollectIpAddress,
  collectMacAddress,
  setCollectMacAddress,
  collectHostname,
  setCollectHostname,
  parallelTasks,
  setParallelTasks,
}: GetClientDataJobTemplateProps) {
  return (
    <>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-emerald-600" />
          <Label className="text-sm font-semibold text-emerald-900">Collect Properties</Label>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="collect-ip"
              checked={collectIpAddress}
              onCheckedChange={checked => setCollectIpAddress(checked === true)}
            />
            <Label htmlFor="collect-ip" className="text-sm font-normal cursor-pointer">
              IP Address <span className="text-xs text-muted-foreground">(from ARP table)</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="collect-mac"
              checked={collectMacAddress}
              onCheckedChange={checked => setCollectMacAddress(checked === true)}
            />
            <Label htmlFor="collect-mac" className="text-sm font-normal cursor-pointer">
              MAC Address <span className="text-xs text-muted-foreground">(from MAC address table)</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="collect-hostname"
              checked={collectHostname}
              onCheckedChange={checked => setCollectHostname(checked === true)}
            />
            <Label htmlFor="collect-hostname" className="text-sm font-normal cursor-pointer">
              Resolve Hostname <span className="text-xs text-muted-foreground">(DNS lookup)</span>
            </Label>
          </div>
        </div>
        <p className="text-xs text-emerald-600">
          Requires SSH credentials. All collected rows share a session ID as the join key.
        </p>
      </div>

      <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-purple-600" />
          <Label className="text-sm font-semibold text-purple-900">Parallel Execution</Label>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="parallel-tasks-gcd" className="text-sm text-purple-900 font-medium">
              Number of Parallel Tasks
            </Label>
            <Badge variant="secondary" className="text-xs">
              {parallelTasks === 1 ? 'Sequential' : `${parallelTasks} workers`}
            </Badge>
          </div>
          <Input
            id="parallel-tasks-gcd"
            type="number"
            min="1"
            max="50"
            value={parallelTasks}
            onChange={e => {
              const value = parseInt(e.target.value) || 1
              setParallelTasks(Math.min(50, Math.max(1, value)))
            }}
            className="h-9 bg-white border-purple-200 focus:ring-purple-500 focus:border-purple-500"
          />
          <p className="text-xs text-purple-600 leading-relaxed">
            <span className="font-semibold">Recommended:</span> 1 = sequential (safe, slow),
            5–10 = moderate parallel execution, 20+ = high parallel execution (requires sufficient
            Celery workers)
          </p>
        </div>
      </div>
    </>
  )
}
