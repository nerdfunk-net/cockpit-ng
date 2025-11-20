import { Metadata } from 'next'
import UserManagement from '../../../components/settings/user-management'

export const metadata: Metadata = {
  title: 'User Management - Cockpit',
  description: 'Manage system users, roles, and permissions',
}

export default function UserManagementPage() {
  return <UserManagement />
}