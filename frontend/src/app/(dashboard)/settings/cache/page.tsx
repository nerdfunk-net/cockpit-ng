import { Metadata } from 'next'
import CacheManagement from '@/components/settings/cache-management'

export const metadata: Metadata = {
  title: 'Cache Settings - Cockpit',
  description: 'Configure cache settings for optimal performance',
}

export default function CacheSettingsPage() {
  return <CacheManagement />
}
