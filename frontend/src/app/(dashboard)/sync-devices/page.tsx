import { Suspense } from 'react'
import { SyncDevicesPage } from '@/components/sync-devices/sync-devices-page'

function SyncDevicesContent() {
  return <SyncDevicesPage />
}

export default function SyncDevicesRoute() {
  return <Suspense fallback={<div className="p-4">Loading sync devices...</div>}>
        <SyncDevicesContent />
      </Suspense>
}
