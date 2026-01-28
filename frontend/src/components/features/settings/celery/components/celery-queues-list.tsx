'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Layers, Users, Clock, AlertCircle } from 'lucide-react'
import { useCeleryQueues } from '../hooks/use-celery-queries'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function CeleryQueuesList() {
  const { data: queues, isLoading, refetch } = useCeleryQueues()

  // Queue color coding based on usage
  const getQueueVariant = (pendingTasks: number, workerCount: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (workerCount === 0 && pendingTasks > 0) return 'destructive' // No workers but tasks waiting
    if (pendingTasks > 10) return 'default' // High load
    if (pendingTasks > 0) return 'secondary' // Some tasks
    return 'outline' // Idle
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Celery Queues</CardTitle>
            <CardDescription>
              Queue metrics, task routing, and worker assignments
            </CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {queues && queues.length > 0 ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    Total Queues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{queues.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    Pending Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {queues.reduce((sum, q) => sum + q.pending_tasks, 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    Active Workers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Set(queues.flatMap(q => q.workers_consuming)).size}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Unassigned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {queues.filter(q => q.worker_count === 0).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Queues without workers</p>
                </CardContent>
              </Card>
            </div>

            {/* Queue Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead>Workers</TableHead>
                  <TableHead>Routed Tasks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.map((queue) => (
                  <TableRow key={queue.name}>
                    <TableCell>
                      <div>
                        <div className="font-mono text-sm font-medium">{queue.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {queue.routing_key}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getQueueVariant(queue.pending_tasks, queue.worker_count)}>
                        {queue.worker_count === 0 && queue.pending_tasks > 0
                          ? 'No Workers'
                          : queue.pending_tasks > 10
                          ? 'High Load'
                          : queue.pending_tasks > 0
                          ? 'Active'
                          : 'Idle'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={queue.pending_tasks > 0 ? 'font-bold text-orange-600' : ''}>
                        {queue.pending_tasks}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={queue.active_tasks > 0 ? 'font-bold text-blue-600' : ''}>
                        {queue.active_tasks}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {queue.worker_count} worker{queue.worker_count !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              {queue.workers_consuming.length > 0 ? (
                                queue.workers_consuming.map((worker) => (
                                  <div key={worker} className="font-mono text-xs">
                                    {worker}
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-muted-foreground">No workers assigned</div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary">
                              {queue.routed_tasks.length} task type{queue.routed_tasks.length !== 1 ? 's' : ''}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 max-w-md">
                              {queue.routed_tasks.length > 0 ? (
                                queue.routed_tasks.map((task) => (
                                  <div key={task} className="font-mono text-xs">
                                    {task}
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-muted-foreground">No tasks routed</div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Queue Details Legend */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Idle</Badge>
                <span>No pending tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Active</Badge>
                <span>1-10 pending</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">High Load</Badge>
                <span>10+ pending</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">No Workers</Badge>
                <span>Tasks waiting, no workers</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No queues configured</p>
        )}
      </CardContent>
    </Card>
  )
}
