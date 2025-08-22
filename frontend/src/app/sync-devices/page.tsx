import { Suspense } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { SyncDevicesPage } from '@/components/sync-devices/sync-devices-page'

export default function SyncDevicesRoute() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="p-4">Loading sync devices...</div>}>
        <SyncDevicesPage />
      </Suspense>
    </DashboardLayout>
  )
}
