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

const BYTES_PER_GB = 1024 ** 3

function isRealMount(m: { device?: string; fstype?: string }): boolean {
  return Boolean(m.device?.startsWith('/dev/') && !VIRTUAL_FS.has(m.fstype ?? ''))
}

function countRealMounts(mounts: Array<{ device?: string; fstype?: string }>): number {
  return mounts.filter(isRealMount).length
}

/** Sum real-mount size_total (bytes) and return whole GB (rounded up). */
function diskTotalGb(
  mounts: Array<{ device?: string; fstype?: string; size_total?: number }>
): number | null {
  const totalBytes = mounts
    .filter(isRealMount)
    .reduce((sum, m) => sum + (m.size_total ?? 0), 0)
  if (totalBytes <= 0) return null
  return Math.ceil(totalBytes / BYTES_PER_GB)
}

/** Used % across real mounts: ceil((total - available) / total * 100). */
function diskUsagePct(
  mounts: Array<{
    device?: string
    fstype?: string
    size_total?: number
    size_available?: number
  }>
): number | null {
  let total = 0
  let available = 0
  for (const m of mounts) {
    if (!isRealMount(m)) continue
    const sizeTotal = m.size_total ?? 0
    if (sizeTotal <= 0) continue
    total += sizeTotal
    available += m.size_available ?? 0
  }
  if (total <= 0) return null
  const used = Math.max(0, total - Math.min(available, total))
  return Math.min(100, Math.ceil((used * 100) / total))
}

/** Fields derived from Ansible get_facts output (excludes user-managed server fields). */
export interface ParsedAnsibleFacts {
  hostname: string
  os_family: string
  processor_count: number | null
  memtotal_mb: number | null
  architecture: string
  distribution: string
  distribution_release: string
  distribution_version: string
  primary_ipv4: string
  primary_interface: string
  disk_count: number
  disk_total_gb: number | null
  disk_usage_pct: number | null
  is_virtual: boolean
  ansible_facts: Record<string, unknown> | null
}

export function parseAnsibleFacts(output: unknown): ParsedAnsibleFacts {
  const raw = output as Record<string, unknown> | null
  const rawFacts = raw?.facts as Record<string, unknown> | undefined
  const f = (rawFacts?.ansible_facts as Record<string, unknown> | undefined) ?? {}

  const defaultIpv4 = f.default_ipv4 as Record<string, string> | undefined
  const mounts =
    (f.mounts as Array<{
      device?: string
      fstype?: string
      size_total?: number
      size_available?: number
    }>) ?? []
  const virtualizationRole = rawFacts?.ansible_virtualization_role as string | undefined

  return {
    hostname: (f.fqdn as string) ?? (f.hostname as string) ?? '',
    os_family: (f.os_family as string) ?? '',
    processor_count: (f.processor_count as number) ?? null,
    memtotal_mb: (f.memtotal_mb as number) ?? null,
    architecture: (f.architecture as string) ?? '',
    distribution: (f.distribution as string) ?? '',
    distribution_release: (f.distribution_release as string) ?? '',
    distribution_version: (f.distribution_version as string) ?? '',
    primary_ipv4: defaultIpv4?.address ?? '',
    primary_interface: defaultIpv4?.interface ?? '',
    disk_count: countRealMounts(mounts),
    disk_total_gb: diskTotalGb(mounts),
    disk_usage_pct: diskUsagePct(mounts),
    is_virtual: virtualizationRole === 'guest',
    ansible_facts: rawFacts ?? null,
  }
}
