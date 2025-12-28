import { Metadata } from 'next'
import CredentialsManagement from '@/components/features/settings/credentials/credentials-management'

export const metadata: Metadata = {
  title: 'Credentials - Cockpit',
  description: 'Manage stored credentials for device access',
}

export default function CredentialsPage() {
  return <CredentialsManagement />
}
