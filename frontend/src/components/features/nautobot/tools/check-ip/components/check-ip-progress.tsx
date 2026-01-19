import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Info } from 'lucide-react'
import type { TaskStatus } from '../types'
import { getProgressValue } from '../utils/check-ip-utils'

interface CheckIPProgressProps {
  taskStatus: TaskStatus
}

export function CheckIPProgress({ taskStatus }: CheckIPProgressProps) {
  const progressValue = getProgressValue(taskStatus.status, taskStatus.progress)

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Info className="h-4 w-4" />
          <span>Progress</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
        <Progress value={progressValue} className="h-2" />
        <div className="text-sm text-muted-foreground">
          {taskStatus.progress ? (
            <p>
              Processed {taskStatus.progress.current} of {taskStatus.progress.total} devices
              {taskStatus.progress.message && ` - ${taskStatus.progress.message}`}
            </p>
          ) : (
            <p>Processing devices...</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
