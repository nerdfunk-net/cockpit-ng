import { DashboardLayout } from '@/components/dashboard-layout'
import CompliancePage from '@/components/compliance/compliance-page'

export default function ComplianceRoute() {
  return (
    <DashboardLayout>
      <CompliancePage />
    </DashboardLayout>
  )
}
