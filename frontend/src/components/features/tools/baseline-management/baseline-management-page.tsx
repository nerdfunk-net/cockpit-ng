'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, FileOutput, FlaskConical } from 'lucide-react'
import { BaselineGenerateForm } from '@/components/features/tools/tests-baseline/tests-baseline-page'
import BaselineImportSection from './baseline-import-section'
import { IconChip } from '@/components/shared/icon-chip'

export default function BaselineManagementPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/tools">
            <Button variant="ghost" size="icon" aria-label="Back to Developer Tools">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <IconChip variant="success">
              <FlaskConical className="h-6 w-6" />
            </IconChip>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Baseline Management</h1>
              <p className="text-muted-foreground text-sm">
                Generate baseline YAML and import test data into Nautobot. Use the
                Pytest profile for the 120-device integration-test contract.
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-6 space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileOutput className="w-5 h-5 text-success-foreground" />
                  Generate baseline
                </CardTitle>
                <CardDescription>
                  Build a baseline YAML file under{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    data/baseline/
                  </code>
                  , copy it to{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    contributing-data/tests_baseline/
                  </code>
                  , then import on the Import tab.
                </CardDescription>
              </CardHeader>
            </Card>
            <BaselineGenerateForm />
          </TabsContent>

          <TabsContent value="import" className="mt-6">
            <BaselineImportSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
