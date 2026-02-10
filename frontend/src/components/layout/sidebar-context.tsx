'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface SidebarContextType {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
  collapsedSections: Set<string>
  setCollapsedSections: (sections: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  collapsedItems: Set<string>
  setCollapsedItems: (items: Set<string> | ((prev: Set<string>) => Set<string>)) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

// Navigation sections - all collapsed by default on login
const navigationSectionTitles = ['General', 'Nautobot', 'CheckMK', 'Agents', 'Network', 'Jobs', 'Settings']

// Collapsible menu items - all collapsed by default on login
const collapsibleMenuItems = [
  'Nautobot-Tools',
  'Network-Configs',
  'Network-Automation',
  'Network-Tools',
  'Settings-Connections',
  'Settings-Templates',
]

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Initialize with ALL sections collapsed (will stay this way until user expands them)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(navigationSectionTitles)
  )
  // Initialize with ALL collapsible items collapsed
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(
    new Set(collapsibleMenuItems)
  )

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <SidebarContext.Provider value={{
      isCollapsed,
      setIsCollapsed,
      toggleCollapsed,
      collapsedSections,
      setCollapsedSections,
      collapsedItems,
      setCollapsedItems
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
