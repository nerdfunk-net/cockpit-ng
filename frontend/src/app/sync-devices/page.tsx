import { Suspense } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { SyncDevicesPage } from '@/components/sync-devices/sync-devices-page'

function SyncDevicesContent() {
  return <SyncDevicesPage />
}

export default function SyncDevicesRoute() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="p-4">Loading sync devices...</div>}>
        <SyncDevicesContent />
      </Suspense>
    </DashboardLayout>
  )
}
