'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  File, 
  GitCommit, 
  History,
  RefreshCw,
  Settings
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import FileCompare from './file-compare'
import GitCompare from './git-compare'
import FileHistoryCompare from './file-history-compare'

type ComparisonMode = 'files' | 'git' | 'history'

export default function ConfigCompare() {
  const { isAuthenticated, token } = useAuthStore()
  
  // Core state
  const [authReady, setAuthReady] = useState(false)
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('files')

  // Authentication effect - simplified since DashboardLayout handles auth
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('Compare: Authentication ready')
      setAuthReady(true)
    }
  }, [isAuthenticated, token])

  const renderContent = () => {
    if (!authReady) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }

    switch (comparisonMode) {
      case 'files':
        return <FileCompare />
      case 'git':
        return <GitCompare />
      case 'history':
        return <FileHistoryCompare />
      default:
        return <FileCompare />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuration Compare</h1>
          <p className="text-gray-600 mt-1">Compare configuration files, Git commits, and analyze file history</p>
        </div>
      </div>

      {/* Mode Selection */}
      <Card className="shadow-lg border-0 overflow-hidden p-0">
        <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-3">
          <CardTitle className="flex items-center space-x-2 text-sm font-medium">
            <Settings className="h-3 w-3" />
            <span>Comparison Mode</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-1.5 px-3 bg-gradient-to-b from-white to-gray-50">
          <div className="flex flex-wrap gap-1.5">
            <Button
              key="mode-files"
              variant={comparisonMode === 'files' ? 'default' : 'outline'}
              onClick={() => setComparisonMode('files')}
              className="flex items-center gap-1.5 h-7 px-2 text-xs"
            >
              <File className="h-3 w-3" />
              Files
            </Button>
            <Button
              key="mode-git"
              variant={comparisonMode === 'git' ? 'default' : 'outline'}
              onClick={() => setComparisonMode('git')}
              className="flex items-center gap-1.5 h-7 px-2 text-xs"
            >
              <GitCommit className="h-3 w-3" />
              Git Commits
            </Button>
            <Button
              key="mode-history"
              variant={comparisonMode === 'history' ? 'default' : 'outline'}
              onClick={() => setComparisonMode('history')}
              className="flex items-center gap-1.5 h-7 px-2 text-xs"
            >
              <History className="h-3 w-3" />
              File History
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Content */}
      {renderContent()}
    </div>
  )
}
