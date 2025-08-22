import { DashboardLayout } from '@/components/dashboard-layout'
import AnsibleInventoryPage from '@/components/ansible-inventory/ansible-inventory-page'

export default function AnsibleInventoryRoute() {
  return (
    <DashboardLayout>
      <AnsibleInventoryPage />
    </DashboardLayout>
  )
}
