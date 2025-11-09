import { DashboardLayout } from '@/components/dashboard-layout'
import NetmikoPage from '@/components/netmiko/netmiko-page'

export default function NetmikoRoute() {
  return (
    <DashboardLayout>
      <NetmikoPage />
    </DashboardLayout>
  )
}
