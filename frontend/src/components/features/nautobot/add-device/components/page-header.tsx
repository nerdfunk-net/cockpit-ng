'use client'

import { Server, FileSpreadsheet, HelpCircle, Wand2, Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconChip } from '@/components/shared/icon-chip'

interface PageHeaderProps {
  isLoading: boolean
  onOpenCsvImport: () => void
  onOpenHelp: () => void
  onUseDefaults?: () => void
  hasDefaults?: boolean
  onGatherFacts?: () => void
  isGatheringFacts?: boolean
}

export function PageHeader({
  isLoading,
  onOpenCsvImport,
  onOpenHelp,
  onUseDefaults,
  hasDefaults,
  onGatherFacts,
  isGatheringFacts,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <IconChip variant="primary">
          <Server className="h-6 w-6" />
        </IconChip>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Add Device to Nautobot</h1>
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
        {onGatherFacts && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onGatherFacts}
            disabled={isLoading || isGatheringFacts}
            title="Gather facts via Ansible"
          >
            {isGatheringFacts ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
          </Button>
        )}
        {onUseDefaults && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onUseDefaults}
            disabled={isLoading || !hasDefaults}
            title="Use defaults"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        )}
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
