import { Metadata } from 'next'
import GitManagement from '@/components/features/settings/git/git-management'

export const metadata: Metadata = {
  title: 'Git Management - Cockpit',
  description: 'Manage Git repositories for configurations, templates, and other resources',
}

export default function GitManagementPage() {
  return <GitManagement />
}
