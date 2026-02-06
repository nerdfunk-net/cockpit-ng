import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HelpCircle, BarChart3, GitBranch, Settings } from 'lucide-react'

interface HelpDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            About Agents
          </DialogTitle>
          <DialogDescription>
            Understanding agent configuration in Cockpit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* What are agents */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              What are Agents?
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              Agents are external applications used for monitoring, metrics collection, and observability.
              Cockpit can manage configurations for applications like <strong>Grafana</strong>,{' '}
              <strong>Telegraf</strong>, <strong>InfluxDB</strong>, and <strong>Smokeping</strong>.
            </p>
          </div>

          {/* How they work */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="h-4 w-4 text-blue-600" />
              How They Work
            </h4>
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                <li>Cockpit renders configuration templates based on your network infrastructure</li>
                <li>Configurations are committed to the configured Git repository</li>
                <li>The agent is called to restart its Docker container</li>
                <li>Your monitoring stack stays synchronized with your infrastructure</li>
              </ol>
            </div>
          </div>

          {/* Configuration steps */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-blue-600" />
              How to Configure an Agent
            </h4>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside ml-1">
              <li>
                <strong>Add a new agent</strong> by clicking the &quot;Add New Agent&quot; button
              </li>
              <li>
                <strong>Provide a name and description</strong> to identify the agent (e.g., &quot;Grafana
                Production&quot;)
              </li>
              <li>
                <strong>Select a Git repository</strong> where the agent&apos;s configuration files will be
                stored
              </li>
              <li>
                <strong>Save the configuration</strong> and the agent will be ready to receive updates from
                Cockpit
              </li>
            </ol>
          </div>

          {/* Note */}
          <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> Make sure your Git repositories are properly configured in Settings →
              Git Management before adding agents. Only repositories with category &quot;Cockpit
              Configs&quot; can be used for agent configurations.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-9 w-9 p-0 rounded-full hover:bg-blue-100"
      title="Help: About Agents"
    >
      <HelpCircle className="h-5 w-5 text-blue-600" />
    </Button>
  )
}
