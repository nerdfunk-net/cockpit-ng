import type { WidgetDefinition, WidgetId } from '../types/dashboard'
import { NautobotDevicesWidget } from '../widgets/nautobot-devices-widget'
import { NautobotLocationsWidget } from '../widgets/nautobot-locations-widget'
import { NautobotIPAddressesWidget } from '../widgets/nautobot-ip-addresses-widget'
import { NautobotPrefixesWidget } from '../widgets/nautobot-prefixes-widget'
import { CheckmkHostsWidget } from '../widgets/checkmk-hosts-widget'
import { FailedJobsWidget } from '../widgets/failed-jobs-widget'
import { DeviceBackupWidget } from '../widgets/device-backup-widget'
import { CheckmkSyncWidget } from '../widgets/checkmk-sync-widget'
import { NetworkScanWidget } from '../widgets/network-scan-widget'
import { StaleIPAddressesWidget } from '../widgets/stale-ip-addresses-widget'

export const WIDGET_REGISTRY: Record<WidgetId, WidgetDefinition> = {
  'nautobot-devices': {
    id: 'nautobot-devices',
    title: 'Nautobot Devices',
    description: 'Total network devices in Nautobot',
    icon: 'Server',
    defaultSize: { w: 2, h: 3, minW: 2, minH: 2 },
    component: NautobotDevicesWidget,
  },
  'nautobot-locations': {
    id: 'nautobot-locations',
    title: 'Nautobot Locations',
    description: 'Physical locations count',
    icon: 'MapPin',
    defaultSize: { w: 2, h: 3, minW: 2, minH: 2 },
    component: NautobotLocationsWidget,
  },
  'nautobot-ip-addresses': {
    id: 'nautobot-ip-addresses',
    title: 'IP Addresses',
    description: 'Assigned IP addresses in Nautobot',
    icon: 'Network',
    defaultSize: { w: 2, h: 3, minW: 2, minH: 2 },
    component: NautobotIPAddressesWidget,
  },
  'nautobot-prefixes': {
    id: 'nautobot-prefixes',
    title: 'Network Prefixes',
    description: 'Total network prefixes in Nautobot',
    icon: 'Layers',
    defaultSize: { w: 2, h: 3, minW: 2, minH: 2 },
    component: NautobotPrefixesWidget,
  },
  'checkmk-hosts': {
    id: 'checkmk-hosts',
    title: 'CheckMK Hosts',
    description: 'Total hosts monitored by CheckMK',
    icon: 'Shield',
    defaultSize: { w: 2, h: 3, minW: 2, minH: 2 },
    component: CheckmkHostsWidget,
  },
  'failed-jobs': {
    id: 'failed-jobs',
    title: 'Failed Jobs',
    description: 'Number of job runs with errors',
    icon: 'XCircle',
    defaultSize: { w: 2, h: 3, minW: 2, minH: 2 },
    component: FailedJobsWidget,
  },
  'device-backup': {
    id: 'device-backup',
    title: 'Device Backup Health',
    description: 'Device backup success rate',
    icon: 'HardDrive',
    defaultSize: { w: 2, h: 3, minW: 2, minH: 2 },
    component: DeviceBackupWidget,
  },
  'checkmk-sync': {
    id: 'checkmk-sync',
    title: 'CheckMK Sync Status',
    description: 'Nautobot ↔ CheckMK device comparison',
    icon: 'RefreshCw',
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    component: CheckmkSyncWidget,
  },
  'network-scan': {
    id: 'network-scan',
    title: 'Network Scan Status',
    description: 'Latest prefix scan results',
    icon: 'Activity',
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    component: NetworkScanWidget,
  },
  'stale-ip-addresses': {
    id: 'stale-ip-addresses',
    title: 'Stale IP Addresses',
    description: 'IPs identified as stale by latest scan',
    icon: 'Network',
    defaultSize: { w: 4, h: 3, minW: 3, minH: 2 },
    component: StaleIPAddressesWidget,
  },
}
