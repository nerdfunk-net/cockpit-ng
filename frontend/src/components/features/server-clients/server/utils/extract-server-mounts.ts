import type { ServerResponse } from '../types'

export interface MountEntry {
  mount: string
  device: string
  fstype: string
  size_total: number
  size_available: number
}

export function extractServerMounts(server: ServerResponse): MountEntry[] {
  const facts = server.ansible_facts
  const ansibleFacts = facts?.ansible_facts as Record<string, unknown> | undefined
  const rawFacts = facts?.facts as Record<string, unknown> | undefined

  return (
    (ansibleFacts?.mounts as MountEntry[] | undefined) ??
    (rawFacts?.ansible_mounts as MountEntry[] | undefined) ??
    []
  )
}
