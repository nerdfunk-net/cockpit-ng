'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlayCircle, RefreshCw } from 'lucide-react'
import { useCeleryMutations } from '../hooks/use-celery-mutations'
import { useTaskStatus } from '../hooks/use-celery-queries'
import { getTaskStatusVariant } from '../utils/celery-utils'

export function CeleryTestPanel() {
  const [testTaskId, setTestTaskId] = useState<string | null>(null)
  const { submitTestTask } = useCeleryMutations()
  const { data: taskStatus, refetch: refetchStatus } = useTaskStatus(testTaskId)

  const handleSubmitTest = async () => {
    const result = await submitTestTask.mutateAsync('Test from Settings UI')
    if (result.task_id) {
      setTestTaskId(result.task_id)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Celery</CardTitle>
        <CardDescription>Submit a test task to verify Celery is working</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleSubmitTest} disabled={submitTestTask.isPending}>
          <PlayCircle className="h-4 w-4 mr-2" />
          Submit Test Task
        </Button>

        {testTaskId && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Task ID:</p>
              <code className="text-sm bg-muted px-2 py-1 rounded">{testTaskId}</code>
            </div>

            {taskStatus && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={getTaskStatusVariant(taskStatus.status)}>
                    {taskStatus.status}
                  </Badge>
                </div>

                {taskStatus.result && (
                  <div>
                    <p className="text-sm font-medium">Result:</p>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(taskStatus.result, null, 2)}
                    </pre>
                  </div>
                )}

                {taskStatus.error && (
                  <div>
                    <p className="text-sm font-medium text-red-600">Error:</p>
                    <p className="text-sm text-red-600">{taskStatus.error}</p>
                  </div>
                )}

                <Button onClick={() => refetchStatus()} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
