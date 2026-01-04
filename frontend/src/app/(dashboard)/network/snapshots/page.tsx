/**
 * Network Snapshots Route
 */

import SnapshotsPage from '@/components/features/network/snapshots/snapshots-page'

export const metadata = {
  title: 'Network Snapshots - Cockpit',
  description: 'Capture and compare network device snapshots',
}

export default function Page() {
  return <SnapshotsPage />
}
