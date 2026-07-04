'use client'

import { useCallback, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Upload, Loader2, BookOpen, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function CodeBlock({ children }: { children: string }) {
  return (
    // Deliberately kept dark: terminal/console output block. No semantic token
    // exists for "console output" background; this pattern is used unmigrated
    // across ~10 other features (job results, snapshot viewers, etc.), so a
    // token should be introduced codebase-wide rather than diverging here.
    <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
      <code>{children}</code>
    </pre>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: ReactNode
}) {
  return (
    <li className="space-y-2">
      <h4 className="font-semibold text-foreground">
        <span className="mr-2 text-success-foreground">{number}.</span>
        {title}
      </h4>
      <div className="text-sm text-muted-foreground leading-relaxed pl-6">{children}</div>
    </li>
  )
}

export default function BaselineImportSection() {
  const { toast } = useToast()
  const [isImporting, setIsImporting] = useState(false)

  const handleImportBaseline = useCallback(async () => {
    setIsImporting(true)
    try {
      const response = await fetch('/api/proxy/tools/tests-baseline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Failed to import test baseline'
        )
      }

      const created = data.created || {}
      const counts = Object.entries(created)
        .filter(([, count]) => typeof count === 'number' && count > 0)
        .map(([resource, count]) => `${count as number} ${resource}`)
        .join(', ')

      toast({
        title: 'Test baseline imported',
        description: counts
          ? `Created: ${counts}`
          : 'Test baseline imported successfully',
      })
    } catch (error) {
      toast({
        title: 'Import failed',
        description:
          error instanceof Error ? error.message : 'Failed to import test baseline',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }, [toast])

  return (
    <div className="space-y-6">
      <Alert className="status-warning border">
        <BookOpen className="h-4 w-4" />
        <AlertTitle>
          Pytest does not load baseline data automatically
        </AlertTitle>
        <AlertDescription className="text-sm">
          Integration tests expect a dedicated test Nautobot instance populated from{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            contributing-data/tests_baseline/baseline.yaml
          </code>
          . You must import that YAML into Nautobot before running{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            pytest -m &quot;integration and nautobot&quot;
          </code>
          . See{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            backend/tests/README.md
          </code>{' '}
          (section &quot;Pytest baseline&quot;) and{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            backend/tests/QUICK_START_INTEGRATION_TESTS.md
          </code>
          .
        </AlertDescription>
      </Alert>

      <Card className="shadow-sm border-success-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-success-foreground" />
            Import test baseline
          </CardTitle>
          <CardDescription>
            Load YAML from{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              contributing-data/tests_baseline/
            </code>{' '}
            into the Nautobot instance configured in Cockpit settings. Existing
            objects are skipped (idempotent).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleImportBaseline} disabled={isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import into Nautobot
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Calls{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              POST /api/tools/tests-baseline
            </code>
            . Override the directory with env{' '}
            <code className="rounded bg-muted px-1 py-0.5">BASELINE_DIR</code>{' '}
            (path relative to <code className="rounded bg-muted px-1 py-0.5">backend/</code>{' '}
            unless absolute).
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Manual: baseline data for Python integration tests</CardTitle>
          <CardDescription>
            End-to-end workflow from YAML on disk to passing{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              pytest -m integration
            </code>{' '}
            tests against real Nautobot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 text-sm text-muted-foreground">
          <section>
            <h3 className="font-semibold text-foreground mb-2">What you get</h3>
            <p>
              The <strong>Pytest integration tests</strong> profile defines a fixed
              contract used by inventory, device-operation, CSV import, and CheckMK
              integration tests:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>
                <strong>120 devices</strong> — 100 network (
                <code className="text-xs">lab-001</code> …{' '}
                <code className="text-xs">lab-100</code>) and 20 servers (
                <code className="text-xs">server-01</code> …{' '}
                <code className="text-xs">server-20</code>)
              </li>
              <li>
                <strong>6 city locations</strong> — City A/B/C and &quot;Another City&quot;
                variants under Country A/B/C
              </li>
              <li>
                <strong>Tags</strong> — Production (39), Staging (52), lab (29)
              </li>
              <li>
                <strong>Statuses</strong> — Active (66), Offline (54)
              </li>
              <li>
                <strong>Roles</strong> — Network, Server (devices + VMs), lab; plus
                custom fields (<code className="text-xs">net</code>,{' '}
                <code className="text-xs">checkmk_site</code>, etc.)
              </li>
            </ul>
            <p className="mt-2">
              Canonical file:{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                contributing-data/tests_baseline/baseline.yaml
              </code>{' '}
              (symlinked as{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                backend/tests/baseline.yaml
              </code>
              ). Expected counts for assertions live in{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                backend/tests/fixtures/baseline_manifest.json
              </code>
              .
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-3">Prerequisites</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Cockpit <strong>backend</strong> and <strong>frontend</strong> running
                (default ports 8000 / 3000).
              </li>
              <li>
                A <strong>test Nautobot</strong> instance (not production) reachable
                from the backend.
              </li>
              <li>
                Nautobot connection configured in Cockpit{' '}
                <Link
                  href="/settings/nautobot"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Settings → Nautobot
                  <ExternalLink className="w-3 h-3" />
                </Link>{' '}
                (URL and API token used for import).
              </li>
              <li>
                Logged into Cockpit with permission to call developer tools (JWT
                session).
              </li>
              <li>
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  contributing-data/tests_baseline/baseline.yaml
                </code>{' '}
                present on the server filesystem (from git clone or after Generate).
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-3">Step-by-step</h3>
            <ol className="space-y-6 list-none pl-0">
              <Step number={1} title="Ensure baseline.yaml is up to date">
                <p>
                  Use the committed file in the repo, or regenerate after changing the
                  Pytest profile on the <strong>Generate</strong> tab:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>
                    Generate with profile <strong>Pytest integration tests</strong>.
                  </li>
                  <li>
                    Copy the output into{' '}
                    <code className="text-xs">
                      contributing-data/tests_baseline/baseline.yaml
                    </code>{' '}
                    if the API wrote under{' '}
                    <code className="text-xs">data/baseline/</code> instead.
                  </li>
                </ul>
                <p className="mt-2">CLI equivalent (from repository root):</p>
                <CodeBlock>{`cd backend
python tests/generate_baseline.py --profile pytest \\
  --output ../contributing-data/tests_baseline`}</CodeBlock>
              </Step>

              <Step number={2} title="Verify YAML (recommended after regeneration)">
                <p>
                  From the <strong>repository root</strong>, confirm stats, unique
                  IPs, and golden metadata parity before commit:
                </p>
                <CodeBlock>{`make verify-baseline
make baseline-manifest`}</CodeBlock>
                <p className="mt-2">
                  Commit{' '}
                  <code className="text-xs">
                    contributing-data/tests_baseline/baseline.yaml
                  </code>{' '}
                  and{' '}
                  <code className="text-xs">
                    backend/tests/fixtures/baseline_manifest.json
                  </code>{' '}
                  if counts changed. Install pre-commit once so{' '}
                  <code className="text-xs">verify-baseline-parity</code> runs on
                  related commits (
                  <code className="text-xs">pip install -r backend/requirements.txt</code>
                  , then <code className="text-xs">pre-commit install</code>).
                </p>
              </Step>

              <Step number={3} title="Configure pytest to use the same Nautobot">
                <p>
                  Integration tests read credentials from{' '}
                  <code className="text-xs">backend/.env.test</code> (not imported by
                  pytest itself):
                </p>
                <CodeBlock>{`cd backend
cp .env.test.example .env.test
# Edit NAUTOBOT_HOST and NAUTOBOT_TOKEN to match your test instance`}</CodeBlock>
                <p className="mt-2">
                  Use the <strong>same</strong> Nautobot host/token as Cockpit settings
                  if you want UI import and pytest to target one environment.
                </p>
              </Step>

              <Step number={4} title="Import into Nautobot (this tab)">
                <p>
                  Open <strong>Tools → Baseline Management → Import</strong> and click{' '}
                  <strong>Import into Nautobot</strong>.
                </p>
                <p className="mt-2">
                  The backend reads all <code className="text-xs">*.yaml</code> /{' '}
                  <code className="text-xs">*.yml</code> files in{' '}
                  <code className="text-xs">
                    contributing-data/tests_baseline/
                  </code>{' '}
                  and creates, in dependency order:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Location types, locations, roles, tags</li>
                  <li>Manufacturers, platforms, device types, custom fields</li>
                  <li>Prefixes, devices (with interfaces and IPs)</li>
                  <li>Cluster types, cluster groups, clusters, virtual machines</li>
                </ul>
                <p className="mt-2">
                  <strong>Idempotent:</strong> existing names are skipped. Re-run import
                  after partial failures; it will not duplicate devices.
                </p>
                <p className="mt-2">
                  API alternative (Cockpit JWT or admin token):
                </p>
                <CodeBlock>{`curl -X POST http://localhost:8000/api/tools/tests-baseline \\
  -H "Authorization: Bearer YOUR_JWT" \\
  -H "Content-Type: application/json"`}</CodeBlock>
              </Step>

              <Step number={5} title="Verify data in Nautobot">
                <p>Confirm anchor devices exist before running tests:</p>
                <CodeBlock>{`# Example: Nautobot REST API
curl "http://localhost:8080/api/dcim/devices/?name=lab-100" \\
  -H "Authorization: Token YOUR_NAUTOBOT_TOKEN"

curl "http://localhost:8080/api/dcim/devices/?name=server-20" \\
  -H "Authorization: Token YOUR_NAUTOBOT_TOKEN"`}</CodeBlock>
                <p className="mt-2">
                  You should see 120 devices total. Filter breakdowns and test cases
                  are documented in{' '}
                  <code className="text-xs">backend/tests/BASELINE_TEST_DATA.md</code>
                  .
                </p>
              </Step>

              <Step number={6} title="Run Python integration tests">
                <p>From <code className="text-xs">backend/</code>:</p>
                <CodeBlock>{`# All real-Nautobot integration tests
pytest -m "integration and nautobot" -v

# Inventory baseline suite (manifest-driven counts)
pytest tests/integration/test_inventory_baseline.py -v

# Device operations (add device, bulk edit)
pytest tests/integration/test_device_operations_real_nautobot.py -v

# CheckMK baseline (also needs CHECKMK_* in .env.test)
pytest tests/integration/test_checkmk_baseline.py -v -m "integration and checkmk"`}</CodeBlock>
                <p className="mt-2">
                  Tests that assert exact device counts use the{' '}
                  <code className="text-xs">baseline_manifest</code> fixture. Nautobot
                  must match the imported YAML; otherwise tests fail even when YAML and
                  manifest are correct on disk.
                </p>
                <p className="mt-2">
                  Inspect one expected filter count:
                </p>
                <CodeBlock>{`cd backend
python scripts/expect_inventory_counts.py --filter filter_by_location_city_a`}</CodeBlock>
              </Step>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-2">Troubleshooting</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Import failed / directory not found</strong> — Backend must see{' '}
                <code className="text-xs">
                  contributing-data/tests_baseline/
                </code>{' '}
                relative to the repo. Set{' '}
                <code className="text-xs">BASELINE_DIR</code> if files live elsewhere.
              </li>
              <li>
                <strong>Nothing created / all skipped</strong> — Data may already exist
                from a previous import. Check Nautobot for{' '}
                <code className="text-xs">lab-001</code> or delete test objects on the
                test instance only.
              </li>
              <li>
                <strong>Tests fail with wrong counts</strong> — Re-import after updating{' '}
                <code className="text-xs">baseline.yaml</code>, or refresh Nautobot from
                a clean test DB. Regenerate{' '}
                <code className="text-xs">baseline_manifest.json</code> if YAML changed.
              </li>
              <li>
                <strong>Tests skipped</strong> — Missing or invalid{' '}
                <code className="text-xs">.env.test</code>; copy from{' '}
                <code className="text-xs">.env.test.example</code>.
              </li>
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-muted p-4">
            <h3 className="font-semibold text-foreground mb-2">Further reading</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <code className="text-xs">backend/tests/README.md</code> — Pytest
                baseline section (generate, manifest, import, run tests)
              </li>
              <li>
                <code className="text-xs">
                  backend/tests/QUICK_START_INTEGRATION_TESTS.md
                </code>{' '}
                — One-page setup
              </li>
              <li>
                <code className="text-xs">doc/PYTEST_BASELINE.md</code> — Profile
                design and golden parity
              </li>
              <li>
                <code className="text-xs">backend/tests/BASELINE_TEST_DATA.md</code>{' '}
                — Per-location device breakdown and filter examples
              </li>
            </ul>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
