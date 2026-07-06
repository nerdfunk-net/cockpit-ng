import type { ComponentType } from 'react'

export type WidgetId =
  | 'nautobot-devices'
  | 'nautobot-locations'
  | 'nautobot-ip-addresses'
  | 'nautobot-prefixes'
  | 'checkmk-hosts'
  | 'failed-jobs'
  | 'device-backup'
  | 'checkmk-sync'
  | 'network-scan'
  | 'port-scan'
  | 'stale-ip-addresses'

export interface WidgetDefaultSize {
  w: number
  h: number
  minW: number
  minH: number
}

export interface WidgetDefinition {
  id: WidgetId
  title: string
  description: string
  icon: string
  defaultSize: WidgetDefaultSize
  component: ComponentType
}

export interface DashboardLayoutItem {
  i: WidgetId
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export interface DashboardLayoutDoc {
  version: 1
  layouts: {
    lg?: DashboardLayoutItem[]
    md?: DashboardLayoutItem[]
    sm?: DashboardLayoutItem[]
    xs?: DashboardLayoutItem[]
    xxs?: DashboardLayoutItem[]
  }
}
