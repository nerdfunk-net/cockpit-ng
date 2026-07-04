import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Play, RefreshCw, Download, Trash2 } from 'lucide-react'
import type { Job } from '../utils/api'

interface JobControlsPanelProps {
  selectedJobId: string
  availableJobs: Job[]
  loadingResults: boolean
  onStartNewJob: () => void
  onSelectJob: (jobId: string) => void
  onLoadResults: () => void
  onRefreshJobs: () => void
  onClearResults: () => void
}

export function JobControlsPanel({
  selectedJobId,
  availableJobs,
  loadingResults,
  onStartNewJob,
  onSelectJob,
  onLoadResults,
  onRefreshJobs,
  onClearResults,
}: JobControlsPanelProps) {
  return (
    <div className="bg-card border rounded-lg shadow-sm">
      {/* Start New Job */}
      <div className="bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1">
              Start New Comparison Job
            </h3>
            <p className="text-sm text-muted-foreground">
              Start a new comprehensive device comparison job that processes all devices
            </p>
          </div>
          <Button onClick={onStartNewJob} className="ml-4">
            <Play className="h-4 w-4 mr-2" />
            Start Device Comparison Job
          </Button>
        </div>
      </div>

      {/* Job Results Selection */}
      <div className="bg-muted p-4 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Label className="text-sm font-medium text-muted-foreground">
              Load Job Results:
            </Label>
            <Select value={selectedJobId} onValueChange={onSelectJob}>
              <SelectTrigger className="h-10 text-sm min-w-[300px]">
                <SelectValue placeholder="Select a completed job to load results..." />
              </SelectTrigger>
              <SelectContent>
                {availableJobs.map((job: Job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {new Date(job.created_at).toLocaleDateString()} -{' '}
                    {job.processed_devices} devices ({job.id.slice(0, 8)}...)
                  </SelectItem>
                ))}
                {availableJobs.length === 0 && (
                  <SelectItem value="no-jobs" disabled>
                    No completed jobs found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={onLoadResults}
              disabled={!selectedJobId || selectedJobId === 'no-jobs' || loadingResults}
              size="sm"
            >
              {loadingResults ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Load Results
            </Button>
            <Button
              onClick={onRefreshJobs}
              variant="outline"
              size="sm"
              title="Refresh Job List"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Jobs
            </Button>
            <Button
              onClick={onClearResults}
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Clear all comparison results"
              disabled={availableJobs.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
