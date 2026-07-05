import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusAlert } from '@/components/shared/status-alert'
import { HelpCircle, BarChart3, GitBranch, Settings } from 'lucide-react'

interface HelpDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <div className="panel-header py-2 px-4 -mt-6 -mx-6 mb-4 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            About Agents
          </DialogTitle>
          <DialogDescription className="text-panel-header-muted">
            Understanding agent configuration in Cockpit
          </DialogDescription>
        </div>

        <div className="space-y-4">
          {/* What are agents */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              What are Agents?
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Agents are external applications used for monitoring, metrics collection,
              and observability. Cockpit can manage configurations for applications like{' '}
              <strong>Grafana</strong>, <strong>Telegraf</strong>,{' '}
              <strong>InfluxDB</strong>, and <strong>Smokeping</strong>.
            </p>
          </div>

          {/* How they work */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              How They Work
            </h4>
            <div className="bg-info p-4 rounded-md border border-info-border">
              <ol className="text-sm text-info-foreground space-y-2 list-decimal list-inside">
                <li>
                  Cockpit renders configuration templates based on your network
                  infrastructure
                </li>
                <li>Configurations are committed to the configured Git repository</li>
                <li>The agent is called to restart its Docker container</li>
                <li>
                  Your monitoring stack stays synchronized with your infrastructure
                </li>
              </ol>
            </div>
          </div>

          {/* Configuration steps */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              How to Configure an Agent
            </h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside ml-1">
              <li>
                <strong>Add a new agent</strong> by clicking the &quot;Add New
                Agent&quot; button
              </li>
              <li>
                <strong>Provide a name and description</strong> to identify the agent
                (e.g., &quot;Grafana Production&quot;)
              </li>
              <li>
                <strong>Select a Git repository</strong> where the agent&apos;s
                configuration files will be stored
              </li>
              <li>
                <strong>Save the configuration</strong> and the agent will be ready to
                receive updates from Cockpit
              </li>
            </ol>
          </div>

          <StatusAlert variant="warning">
            <strong>Note:</strong> Make sure your Git repositories are properly
            configured in Settings → Git Management before adding agents. Only
            repositories with category &quot;Agent&quot; can be used for agent
            configurations.
          </StatusAlert>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Got it</Button>
        </DialogFooter>
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
      className="h-9 w-9 p-0 rounded-full hover:bg-primary/10"
      title="Help: About Agents"
    >
      <HelpCircle className="h-5 w-5 text-primary" />
    </Button>
  )
}
