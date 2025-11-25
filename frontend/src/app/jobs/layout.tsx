import { DashboardLayout } from "@/components/dashboard-layout"

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}
