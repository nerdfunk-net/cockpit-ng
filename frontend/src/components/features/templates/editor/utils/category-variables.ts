import type { TemplateVariable } from '../types'

interface CategoryConfig {
  defaults: string[]
  descriptions: Record<string, string>
}

const CATEGORY_VARIABLES: Record<string, CategoryConfig> = {
  agent: {
    defaults: ['devices', 'device_details', 'snmp_mapping', 'path'],
    descriptions: {
      devices: 'List of devices from inventory',
      device_details: 'Detailed device data from Nautobot (per device)',
      snmp_mapping: 'SNMP credential mapping (if enabled)',
      path: 'Deployment path',
    },
  },
  netmiko: {
    defaults: ['device', 'hostname', 'ip_address', 'platform'],
    descriptions: {
      device: 'Target device object from Nautobot',
      hostname: 'Device hostname',
      ip_address: 'Device management IP',
      platform: 'Device platform/OS',
    },
  },
  __none__: {
    defaults: [],
    descriptions: {},
  },
}

export function getDefaultVariables(category: string): TemplateVariable[] {
  const config = CATEGORY_VARIABLES[category] ?? CATEGORY_VARIABLES['__none__']!
  return config.defaults.map((name) => ({
    id: `default-${name}`,
    name,
    value: '',
    isDefault: true,
    isAutoFilled: true,
    description: config.descriptions[name] || '',
  }))
}

export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_VARIABLES[category] ?? CATEGORY_VARIABLES['__none__']!
}
