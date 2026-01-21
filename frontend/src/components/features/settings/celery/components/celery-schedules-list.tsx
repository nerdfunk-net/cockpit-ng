'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw } from 'lucide-react'
import { useCelerySchedules } from '../hooks/use-celery-queries'
import { EMPTY_SCHEDULES } from '../utils/constants'

export function CelerySchedulesList() {
  const { data: schedules = EMPTY_SCHEDULES, isLoading, refetch } = useCelerySchedules()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Periodic Task Schedules</CardTitle>
            <CardDescription>Tasks configured to run on a schedule via Celery Beat</CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {schedules.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schedule Name</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Schedule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.name}>
                  <TableCell className="font-medium">{schedule.name}</TableCell>
                  <TableCell className="font-mono text-sm">{schedule.task}</TableCell>
                  <TableCell className="text-sm">{schedule.schedule}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No schedules configured</p>
        )}
      </CardContent>
    </Card>
  )
}
