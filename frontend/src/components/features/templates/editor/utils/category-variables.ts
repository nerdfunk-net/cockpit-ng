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
  ansible: {
    defaults: ['hosts', 'groups', 'inventory_name'],
    descriptions: {
      hosts: 'List of target hosts',
      groups: 'Host group assignments',
      inventory_name: 'Name of the inventory',
    },
  },
  onboarding: {
    defaults: ['device', 'device_type', 'platform', 'location', 'role'],
    descriptions: {
      device: 'Device being onboarded',
      device_type: 'Hardware model',
      platform: 'Software platform',
      location: 'Physical location',
      role: 'Device role',
    },
  },
  parser: {
    defaults: ['input', 'template_name'],
    descriptions: {
      input: 'Raw command output to parse',
      template_name: 'Name of the TextFSM template',
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
