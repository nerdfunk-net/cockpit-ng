import { DashboardLayout } from '@/components/dashboard-layout'
import { AddDevicePage } from '@/components/nautobot-add-device/add-device-page'

export default function Page() {
  return (
    <DashboardLayout>
      <AddDevicePage />
    </DashboardLayout>
  )
}
