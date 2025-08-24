import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// API Configuration - All requests go through Next.js API routes
export const API_CONFIG = {
  baseUrl: '', // Always use relative URLs - Next.js handles the proxying
  endpoints: {
    auth: {
      login: '/api/auth/login',
      refresh: '/api/auth/refresh',
      logout: '/api/auth/logout',
    },
    nautobot: {
      locations: '/api/proxy/nautobot/locations',
      devices: '/api/proxy/nautobot/devices',
      onboardDevice: '/api/proxy/nautobot/devices/onboard',
    },
    settings: {
      nautobot: '/api/proxy/settings/nautobot',
      git: '/api/proxy/settings/git',
      cache: '/api/proxy/settings/cache',
      credentials: '/api/proxy/settings/credentials',
    },
    templates: {
      list: '/api/proxy/templates',
      create: '/api/proxy/templates',
      render: '/api/proxy/templates/render',
      import: '/api/proxy/templates/import',
    },
    git: {
      status: '/api/proxy/git/status',
      sync: '/api/proxy/git/sync',
      repositories: '/api/proxy/git/repositories',
    },
    ansible: {
      inventory: '/api/proxy/ansible/inventory',
    },
    configs: {
      backup: '/api/proxy/configs/backup',
      compare: '/api/proxy/configs/compare',
    },
    scan: {
      devices: '/api/proxy/scan/devices',
      add: '/api/proxy/scan/add',
    },
  },
}

// API Request Helper - Always use Next.js API routes
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  if (typeof window === 'undefined') return null
  
  const token = localStorage.getItem('cockpit-auth')
  const authData = token ? JSON.parse(token) : null
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authData?.state?.token && {
        Authorization: `Bearer ${authData.state.token}`,
      }),
      ...options.headers,
    },
  }

  // All requests go through Next.js API routes (no direct backend calls)
  const url = endpoint.startsWith('/api') ? endpoint : `/api/proxy${endpoint}`

  const response = await fetch(url, config)

  if (response.status === 401) {
    // Token expired, redirect to login
    localStorage.removeItem('cockpit-auth')
    window.location.href = '/login'
    return
  }

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Format utilities
export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
