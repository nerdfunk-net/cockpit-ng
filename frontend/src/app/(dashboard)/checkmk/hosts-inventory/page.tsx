import { Suspense } from 'react'
import HostsInventoryPage from '@/components/features/checkmk/hosts-inventory/hosts-inventory-page'

export default function HostsInventory() {
  return <Suspense fallback={<div className="p-4">Loading Hosts & Inventory...</div>}>
        <HostsInventoryPage />
      </Suspense>
}
