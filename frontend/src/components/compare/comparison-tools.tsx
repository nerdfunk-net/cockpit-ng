'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  File, 
  GitCommit, 
  History,
  ArrowRight,
  CheckCircle,
  Clock,
  GitBranch
} from 'lucide-react'
import Link from 'next/link'

export default function ComparisonTools() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Configuration Comparison Tools</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Choose the comparison tool that best fits your needs. Each tool is optimized for specific comparison scenarios.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* File Compare */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <File className="h-6 w-6 text-blue-600" />
              File Compare
            </CardTitle>
            <CardDescription>
              Compare two configuration files side by side with detailed diff visualization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Side-by-side file comparison</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Line-by-line diff highlighting</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Export diff as patch file</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Adjustable font size</span>
              </div>
            </div>
            <Link href="/compare?mode=files">
              <Button className="w-full flex items-center gap-2">
                <File className="h-4 w-4" />
                Open File Compare
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Git Compare */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCommit className="h-6 w-6 text-purple-600" />
              Git Compare
            </CardTitle>
            <CardDescription>
              Compare configuration files between different Git commits and branches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Compare between commits</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Branch selection support</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Commit history navigation</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Visual diff with Git metadata</span>
              </div>
            </div>
            <Link href="/compare?mode=git">
              <Button className="w-full flex items-center gap-2">
                <GitCommit className="h-4 w-4" />
                Open Git Compare
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* File History */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-6 w-6 text-orange-600" />
              File History
            </CardTitle>
            <CardDescription>
              Track changes to specific files across Git commits with timeline visualization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-orange-500" />
                <span>Timeline-based file tracking</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <GitBranch className="h-4 w-4 text-orange-500" />
                <span>File-specific Git history</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-orange-500" />
                <span>Multi-commit comparison</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="h-4 w-4" />
                <span>Coming Soon</span>
              </div>
            </div>
            <Link href="/compare?mode=history">
              <Button className="w-full flex items-center gap-2" variant="outline" disabled>
                <History className="h-4 w-4" />
                File History (Preview)
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Features Overview */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Common Features
          </CardTitle>
          <CardDescription>
            All comparison tools share these powerful features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Syntax highlighting</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Real-time file search</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Repository integration</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Export capabilities</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Live sync with Git</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Responsive design</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Customizable interface</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Fast performance</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Quick steps to start comparing configuration files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-700 font-bold">1</span>
              </div>
              <div>
                <h4 className="font-medium">Select Repository</h4>
                <p className="text-sm text-gray-600">Choose your Git repository from the configured list</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-700 font-bold">2</span>
              </div>
              <div>
                <h4 className="font-medium">Choose Tool</h4>
                <p className="text-sm text-gray-600">Pick the comparison tool that fits your needs</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-700 font-bold">3</span>
              </div>
              <div>
                <h4 className="font-medium">Compare & Analyze</h4>
                <p className="text-sm text-gray-600">Select files or commits and start comparing</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
