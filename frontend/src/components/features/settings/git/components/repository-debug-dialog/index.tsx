// Repository Debug Dialog - Main Component

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bug, Info, FileText, Edit, X, Upload } from 'lucide-react'
import { DiagnosticsTab } from './diagnostics-tab'
import { TestOperationTab } from './test-operation-tab'
import type { GitRepository, DebugResult, DebugOperation } from '../../types'

interface RepositoryDebugDialogProps {
  show: boolean
  onClose: () => void
  repository: GitRepository | null
  result: DebugResult | null
  currentTab: string
  onTabChange: (tab: string) => void
  isLoading: boolean
  onRunOperation: (operation: DebugOperation) => Promise<void>
}

export function RepositoryDebugDialog({
  show,
  onClose,
  repository,
  result,
  currentTab,
  onTabChange,
  isLoading,
  onRunOperation,
}: RepositoryDebugDialogProps) {
  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="!max-w-[90vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-purple-600" />
            Debug Repository: {repository?.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={onTabChange} className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="diagnostics" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Diagnostics
            </TabsTrigger>
            <TabsTrigger value="read" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Read Test
            </TabsTrigger>
            <TabsTrigger value="write" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Write Test
            </TabsTrigger>
            <TabsTrigger value="delete" className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Delete Test
            </TabsTrigger>
            <TabsTrigger value="push" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Push Test
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diagnostics">
            <DiagnosticsTab
              result={result}
              isLoading={isLoading}
              onRun={() => onRunOperation('diagnostics')}
            />
          </TabsContent>

          <TabsContent value="read">
            <TestOperationTab
              title="Read Test"
              description="Test reading a file from the repository to verify read permissions"
              operation="read"
              result={result}
              isLoading={isLoading}
              onRun={() => onRunOperation('read')}
            />
          </TabsContent>

          <TabsContent value="write">
            <TestOperationTab
              title="Write Test"
              description="Test writing a file to the repository to verify write permissions"
              operation="write"
              result={result}
              isLoading={isLoading}
              onRun={() => onRunOperation('write')}
            />
          </TabsContent>

          <TabsContent value="delete">
            <TestOperationTab
              title="Delete Test"
              description="Test deleting the test file from the repository"
              operation="delete"
              result={result}
              isLoading={isLoading}
              onRun={() => onRunOperation('delete')}
              variant="destructive"
            />
          </TabsContent>

          <TabsContent value="push">
            <TestOperationTab
              title="Push Test"
              description="Test pushing changes to the remote repository (creates a commit and pushes to remote)"
              operation="push"
              result={result}
              isLoading={isLoading}
              onRun={() => onRunOperation('push')}
              warning="This will create a real commit and push to the remote repository"
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
