'use client'

import { Terminal } from 'lucide-react'

export function DeployInstructions() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Cockpit agents run on remote servers to execute commands like git pull and docker restart.
      </p>
      <div className="space-y-2">
        <h4 className="font-medium">Quick Start</h4>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
          <li>Go to <span className="font-medium">Agents &rarr; Deploy</span> to generate an agent package</li>
          <li>Transfer the package to your target server</li>
          <li>Run the install script to start the agent</li>
          <li>The agent will register automatically and appear above</li>
        </ol>
      </div>
      <div className="bg-muted/50 rounded-md p-3 font-mono text-xs flex items-start gap-2">
        <Terminal className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <code>./install.sh --server https://your-cockpit-url:8000</code>
      </div>
    </div>
  )
}
