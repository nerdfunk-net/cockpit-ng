const VIRTUAL_FS = new Set([
  'tmpfs',
  'proc',
  'sysfs',
  'devtmpfs',
  'cgroup',
  'cgroup2',
  'devpts',
  'hugetlbfs',
  'mqueue',
  'securityfs',
  'fusectl',
  'pstore',
])

function countRealMounts(mounts: Array<{ device?: string; fstype?: string }>): number {
  return mounts.filter(
    (m) => m.device?.startsWith('/dev/') && !VIRTUAL_FS.has(m.fstype ?? '')
  ).length
}

/** Fields derived from Ansible get_facts output (excludes user-managed server fields). */
export interface ParsedAnsibleFacts {
  hostname: string
  os_family: string
  processor_count: number | null
  memtotal_mb: number | null
  architecture: string
  distribution_release: string
  distribution_version: string
  primary_ipv4: string
  primary_interface: string
  disk_count: number
  is_virtual: boolean
  ansible_facts: Record<string, unknown> | null
}

export function parseAnsibleFacts(output: unknown): ParsedAnsibleFacts {
  const raw = output as Record<string, unknown> | null
  const rawFacts = raw?.facts as Record<string, unknown> | undefined
  const f = (rawFacts?.ansible_facts as Record<string, unknown> | undefined) ?? {}

  const defaultIpv4 = f.default_ipv4 as Record<string, string> | undefined
  const mounts = (f.mounts as Array<{ device?: string; fstype?: string }>) ?? []
  const virtualizationRole = rawFacts?.ansible_virtualization_role as string | undefined

  return {
    hostname: (f.fqdn as string) ?? (f.hostname as string) ?? '',
    os_family: (f.os_family as string) ?? '',
    processor_count: (f.processor_count as number) ?? null,
    memtotal_mb: (f.memtotal_mb as number) ?? null,
    architecture: (f.architecture as string) ?? '',
    distribution_release: (f.distribution_release as string) ?? '',
    distribution_version: (f.distribution_version as string) ?? '',
    primary_ipv4: defaultIpv4?.address ?? '',
    primary_interface: defaultIpv4?.interface ?? '',
    disk_count: countRealMounts(mounts),
    is_virtual: virtualizationRole === 'guest',
    ansible_facts: rawFacts ?? null,
  }
}
