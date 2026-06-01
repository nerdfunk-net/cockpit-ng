import type { InterfaceTypeOption } from '@/components/features/nautobot/add-device/types'

/** Resolve Nautobot interface type value for "virtual" from dropdown options. */
export function resolveVirtualInterfaceType(
  interfaceTypes: InterfaceTypeOption[]
): string | undefined {
  const match = interfaceTypes.find(
    t => t.value === 'virtual' || t.display_name?.toLowerCase() === 'virtual'
  )
  return match?.value
}
