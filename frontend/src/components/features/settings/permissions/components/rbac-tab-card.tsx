import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface RBACTabCardProps {
  icon: LucideIcon
  title: string
  children: ReactNode
}

export function RBACTabCard({ icon: Icon, title, children }: RBACTabCardProps) {
  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-t-lg m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Icon className="h-5 w-5" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50">
        {children}
      </CardContent>
    </Card>
  )
}
