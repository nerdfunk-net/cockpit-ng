'use client'

import { Server, FileSpreadsheet, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageHeaderProps {
  isLoading: boolean
  onOpenCsvImport: () => void
  onOpenHelp: () => void
}

export function PageHeader({ isLoading, onOpenCsvImport, onOpenHelp }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Server className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Add Device to Nautobot</h1>
          <p className="text-muted-foreground mt-2">
            Add a new network device or bare metal server
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onOpenCsvImport}
          disabled={isLoading}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Import from CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onOpenHelp}
          disabled={isLoading}
          title="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
