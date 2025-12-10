import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const EMPTY_INIT: RequestInit = {}

// API Request Helper - Always use Next.js API routes
export async function apiRequest(endpoint: string, options: RequestInit = EMPTY_INIT) {
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
