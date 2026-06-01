'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Network } from 'lucide-react'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import { useToast } from '@/hooks/use-toast'
import type { SelectedInterface, ServerResponse } from '../types'

interface Ipv4Info {
  address?: string
  netmask?: string
  broadcast?: string
  network?: string
  prefix?: string
}

interface InterfacesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  server: ServerResponse
}

function extractInterfaces(server: ServerResponse): string[] {
  const ansibleFacts = server.ansible_facts?.ansible_facts as Record<string, unknown> | undefined
  const rawFacts = server.ansible_facts?.facts as Record<string, unknown> | undefined

  const names =
    (ansibleFacts?.interfaces as string[] | undefined) ??
    (rawFacts?.ansible_interfaces as string[] | undefined) ??
    []

  return names.filter((n) => n !== 'lo')
}

function getIpv4(server: ServerResponse, ifaceName: string): Ipv4Info | undefined {
  const ansibleFacts = server.ansible_facts?.ansible_facts as Record<string, unknown> | undefined
  const rawFacts = server.ansible_facts?.facts as Record<string, unknown> | undefined

  return (
    ((ansibleFacts?.[ifaceName] as Record<string, unknown> | undefined)?.ipv4 as Ipv4Info | undefined) ??
    ((rawFacts?.[`ansible_${ifaceName}`] as Record<string, unknown> | undefined)?.ipv4 as Ipv4Info | undefined)
  )
}

export function InterfacesDialog({ open, onOpenChange, server }: InterfacesDialogProps) {
  const { updateServer } = useServerMutations()
  const { toast } = useToast()

  const availableInterfaces = useMemo(() => extractInterfaces(server), [server])

  const initialSelected = useMemo<Set<string>>(
    () => new Set((server.selected_interfaces ?? []).map((i) => i.name)),
    [server.selected_interfaces]
  )

  const [selectedNames, setSelectedNames] = useState<Set<string>>(initialSelected)

  // Re-sync when server prop changes (e.g. after save)
  const [prevServerId, setPrevServerId] = useState(server.id)
  if (server.id !== prevServerId) {
    setPrevServerId(server.id)
    setSelectedNames(initialSelected)
  }

  // Also reset selection when dialog opens
  const [prevOpen, setPrevOpen] = useState(open)
  if (open && !prevOpen) {
    setSelectedNames(initialSelected)
  }
  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  const toggleInterface = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    const selected: SelectedInterface[] = availableInterfaces
      .filter((name) => selectedNames.has(name))
      .map((name) => {
        const ipv4 = getIpv4(server, name)
        return {
          name,
          address: ipv4?.address,
          netmask: ipv4?.netmask,
          broadcast: ipv4?.broadcast,
          network: ipv4?.network,
          prefix: ipv4?.prefix,
        }
      })

    await updateServer.mutateAsync(
      { id: server.id, data: { selected_interfaces: selected } },
      {
        onSuccess: () => {
          toast({ title: 'Interfaces saved', description: `${selected.length} interface(s) stored.` })
          onOpenChange(false)
        },
      }
    )
  }, [availableInterfaces, selectedNames, server, updateServer, toast, onOpenChange])

  const isSaving = updateServer.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-blue-600" />
            Manage Interfaces
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {availableInterfaces.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No interface data found in Ansible facts.
            </p>
          ) : (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-8 px-3 py-2" />
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Interface</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {availableInterfaces.map((name, i) => {
                    const ipv4 = getIpv4(server, name)
                    const checked = selectedNames.has(name)
                    return (
                      <tr
                        key={name}
                        className={`cursor-pointer ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}
                        onClick={() => toggleInterface(name)}
                      >
                        <td className="px-3 py-2.5">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleInterface(name)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-gray-800">{name}</td>
                        <td className="px-3 py-2.5 text-gray-500">
                          {ipv4?.address
                            ? `${ipv4.address}${ipv4.prefix ? `/${ipv4.prefix}` : ''}`
                            : <span className="italic text-gray-300">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || availableInterfaces.length === 0}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Add Interfaces'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
