'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Database,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Info,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { IconChip } from '@/components/shared/icon-chip'

interface ColumnDiff {
  table: string
  column: string
  db_type: string
  model_type: string
  type_changed: boolean
  nullable_changed: boolean
  db_nullable: boolean
  model_nullable: boolean
  safe: boolean
}

interface SchemaItem {
  table: string
  column?: string
  index?: string
}

interface SchemaStatus {
  is_up_to_date: boolean
  missing_tables: string[]
  extra_tables: string[]
  missing_columns: SchemaItem[]
  extra_columns: SchemaItem[]
  column_diffs: ColumnDiff[]
  missing_indexes: SchemaItem[]
  extra_indexes: SchemaItem[]
}

interface MigrationResponse {
  success: boolean
  message: string
  tables_created: number
  columns_added: number
  indexes_created: number
  column_changes_applied: string[]
  column_changes_skipped: string[]
  errors: string[]
}

interface SeedRbacResponse {
  success: boolean
  message: string
  output: string
}

const EMPTY_DIFFS: ColumnDiff[] = []

function columnDiffDescription(cd: ColumnDiff): string {
  const parts: string[] = []
  if (cd.type_changed) parts.push(`${cd.db_type} → ${cd.model_type}`)
  if (cd.nullable_changed) {
    parts.push(
      cd.model_nullable ? 'NOT NULL → NULL' : 'NULL → NOT NULL'
    )
  }
  return parts.join(', ')
}

export default function DatabaseMigrationPage() {
  const { apiCall } = useApi()
  const [status, setStatus] = useState<SchemaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Force apply state
  const [showForceDialog, setShowForceDialog] = useState(false)
  const [forceConfirmed, setForceConfirmed] = useState(false)

  // RBAC seeding state
  const [showSeedDialog, setShowSeedDialog] = useState(false)
  const [seedResult, setSeedResult] = useState<SeedRbacResponse | null>(null)
  const [showSeedOutputModal, setShowSeedOutputModal] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [removeExisting, setRemoveExisting] = useState(false)

  const riskyDiffs = useMemo(
    () => status?.column_diffs.filter(cd => !cd.safe) ?? EMPTY_DIFFS,
    [status]
  )
  const safeDiffs = useMemo(
    () => status?.column_diffs.filter(cd => cd.safe) ?? EMPTY_DIFFS,
    [status]
  )
  const hasSafeChanges = useMemo(
    () =>
      !!(
        status &&
        (status.missing_tables.length > 0 ||
          status.missing_columns.length > 0 ||
          status.missing_indexes.length > 0 ||
          safeDiffs.length > 0)
      ),
    [status, safeDiffs]
  )

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiCall<SchemaStatus>('tools/schema/status')
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schema status')
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  const runMigration = useCallback(
    async (force: boolean) => {
      setMigrating(true)
      setMigrationResult(null)
      try {
        const data = await apiCall<MigrationResponse>(
          `tools/schema/migrate${force ? '?force=true' : ''}`,
          { method: 'POST' }
        )
        setMigrationResult(data)
        if (data.success) {
          await fetchStatus()
          setShowSeedDialog(true)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network or server error'
        setMigrationResult({
          success: false,
          message: msg,
          tables_created: 0,
          columns_added: 0,
          indexes_created: 0,
          column_changes_applied: [],
          column_changes_skipped: [],
          errors: [msg],
        })
      } finally {
        setMigrating(false)
      }
    },
    [apiCall, fetchStatus]
  )

  const handleSync = useCallback(() => runMigration(false), [runMigration])

  const handleForceConfirm = useCallback(async () => {
    setShowForceDialog(false)
    setForceConfirmed(false)
    await runMigration(true)
  }, [runMigration])

  const handleSeedRbac = useCallback(async () => {
    setShowSeedDialog(false)
    setSeedResult(null)
    setSeeding(true)
    try {
      const data = await apiCall<SeedRbacResponse>(
        `tools/rbac/seed?remove_existing=${removeExisting}`,
        { method: 'POST' }
      )
      setSeedResult(data)
      setShowSeedOutputModal(true)
      setRemoveExisting(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to seed RBAC'
      setSeedResult({ success: false, message: msg, output: `Error: ${msg}` })
      setShowSeedOutputModal(true)
      setRemoveExisting(false)
    } finally {
      setSeeding(false)
    }
  }, [apiCall, removeExisting])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <IconChip variant="primary">
              <Database className="h-6 w-6" />
            </IconChip>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Database Migration</h1>
              <p className="text-muted-foreground text-sm">
                Compare and synchronize database schema against SQLAlchemy models
              </p>
            </div>
          </div>
        </div>

        {/* Schema Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Schema Status</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStatus}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <CardDescription>
              Detected differences between the live database and SQLAlchemy model
              definitions. Missing items are created on sync. Risky column changes
              require force apply or{' '}
              <code className="text-xs bg-muted px-1 rounded">
                APPLY_RISKY_DATABASE_MIGRATION=true
              </code>{' '}
              in <code className="text-xs bg-muted px-1 rounded">.env</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-4 status-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : status ? (
              <div className="space-y-6">
                {/* Status Banner */}
                <div
                  className={`p-4 rounded-lg flex items-center gap-3 border ${
                    status.is_up_to_date ? 'status-success' : 'status-warning'
                  }`}
                >
                  {status.is_up_to_date ? (
                    <CheckCircle className="w-6 h-6 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-lg">
                      {status.is_up_to_date
                        ? 'Schema is in sync'
                        : 'Schema differences detected'}
                    </p>
                    <p className="text-sm opacity-90">
                      {status.is_up_to_date
                        ? 'All model definitions match the live database.'
                        : `${status.missing_tables.length} missing table(s), ${status.missing_columns.length} missing column(s), ${status.column_diffs.length} column change(s), ${status.missing_indexes.length} missing index(es).`}
                    </p>
                  </div>
                </div>

                {/* Missing Tables */}
                {status.missing_tables.length > 0 && (
                  <section>
                    <h3 className="font-medium mb-2 flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                      Missing Tables ({status.missing_tables.length})
                      <span className="text-muted-foreground font-normal">— will be created on sync</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {status.missing_tables.map(t => (
                        <div
                          key={t}
                          className="bg-card border rounded px-3 py-1.5 text-sm font-mono text-muted-foreground shadow-sm"
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Missing Columns */}
                {status.missing_columns.length > 0 && (
                  <section>
                    <h3 className="font-medium mb-2 flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-warning-foreground shrink-0" />
                      Missing Columns ({status.missing_columns.length})
                      <span className="text-muted-foreground font-normal">— will be added on sync</span>
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted">
                            <TableHead>Table</TableHead>
                            <TableHead>Column</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {status.missing_columns.map(item => (
                            <TableRow key={`${item.table}-${item.column}`}>
                              <TableCell className="font-medium">{item.table}</TableCell>
                              <TableCell className="font-mono text-primary">
                                {item.column}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                )}

                {/* Missing Indexes */}
                {status.missing_indexes.length > 0 && (
                  <section>
                    <h3 className="font-medium mb-2 flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      Missing Indexes ({status.missing_indexes.length})
                      <span className="text-muted-foreground font-normal">— will be created on sync</span>
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted">
                            <TableHead>Table</TableHead>
                            <TableHead>Index</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {status.missing_indexes.map(item => (
                            <TableRow key={`${item.table}-${item.index}`}>
                              <TableCell className="font-medium">{item.table}</TableCell>
                              <TableCell className="font-mono text-primary">
                                {item.index}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                )}

                {/* Safe Column Changes */}
                {safeDiffs.length > 0 && (
                  <section>
                    <h3 className="font-medium mb-2 flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      Safe Column Changes ({safeDiffs.length})
                      <span className="text-muted-foreground font-normal">— applied on sync</span>
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted">
                            <TableHead>Table</TableHead>
                            <TableHead>Column</TableHead>
                            <TableHead>Change</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {safeDiffs.map(cd => (
                            <TableRow key={`${cd.table}-${cd.column}`}>
                              <TableCell className="font-medium">{cd.table}</TableCell>
                              <TableCell className="font-mono text-primary">
                                {cd.column}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <span className="font-mono">{cd.db_type}</span>
                                  <ArrowRight className="w-3 h-3 shrink-0" />
                                  <span className="font-mono">{cd.model_type}</span>
                                  {cd.nullable_changed && (
                                    <span className="ml-1 text-muted-foreground">
                                      {cd.model_nullable ? '(drop NOT NULL)' : '(add NOT NULL)'}
                                    </span>
                                  )}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                )}

                {/* Risky Column Changes */}
                {riskyDiffs.length > 0 && (
                  <section>
                    <h3 className="font-medium mb-2 flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                      Risky Column Changes ({riskyDiffs.length})
                      <Badge variant="destructive" className="text-xs ml-1">
                        Force required
                      </Badge>
                    </h3>
                    <Alert className="mb-2 status-error border">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        These changes may cause data loss (type casts) or fail if existing
                        rows contain NULL values (NOT NULL addition). Use Force Apply or set{' '}
                        <code className="bg-muted px-1 rounded text-xs">
                          APPLY_RISKY_DATABASE_MIGRATION=true
                        </code>{' '}
                        in <code className="bg-muted px-1 rounded text-xs">.env</code>.
                        Alternatively, run{' '}
                        <code className="bg-muted px-1 rounded text-xs">
                          python scripts/database/sync.py --migrate --force
                        </code>
                        .
                      </AlertDescription>
                    </Alert>
                    <div className="border border-error-border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-error">
                            <TableHead>Table</TableHead>
                            <TableHead>Column</TableHead>
                            <TableHead>Change</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {riskyDiffs.map(cd => (
                            <TableRow key={`${cd.table}-${cd.column}`}>
                              <TableCell className="font-medium">{cd.table}</TableCell>
                              <TableCell className="font-mono text-error-foreground">
                                {cd.column}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <span className="font-mono">{cd.db_type}</span>
                                  <ArrowRight className="w-3 h-3 shrink-0" />
                                  <span className="font-mono">{cd.model_type}</span>
                                  {cd.nullable_changed && (
                                    <span className="ml-1 text-muted-foreground">
                                      {cd.model_nullable ? '(drop NOT NULL)' : '(add NOT NULL)'}
                                    </span>
                                  )}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                )}

                {/* Extra items — informational */}
                {(status.extra_tables.length > 0 ||
                  status.extra_columns.length > 0 ||
                  status.extra_indexes.length > 0) && (
                  <section>
                    <h3 className="font-medium mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Info className="w-4 h-4 shrink-0" />
                      Extra items in database (not in models)
                      <span className="font-normal">— informational only, not removed</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {status.extra_tables.length > 0 && (
                        <div className="bg-muted border rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Tables ({status.extra_tables.length})
                          </p>
                          <div className="space-y-1">
                            {status.extra_tables.map(t => (
                              <div key={t} className="text-sm font-mono text-muted-foreground">
                                {t}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {status.extra_columns.length > 0 && (
                        <div className="bg-muted border rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Columns ({status.extra_columns.length})
                          </p>
                          <div className="space-y-1">
                            {status.extra_columns.map(item => (
                              <div
                                key={`${item.table}-${item.column}`}
                                className="text-sm font-mono text-muted-foreground"
                              >
                                {item.table}.{item.column}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {status.extra_indexes.length > 0 && (
                        <div className="bg-muted border rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Indexes ({status.extra_indexes.length})
                          </p>
                          <div className="space-y-1">
                            {status.extra_indexes.map(item => (
                              <div
                                key={`${item.table}-${item.index}`}
                                className="text-sm font-mono text-muted-foreground"
                              >
                                {item.index}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Action Bar */}
                {!status.is_up_to_date && (
                  <div className="pt-4 border-t flex items-center justify-end gap-3">
                    {riskyDiffs.length > 0 && (
                      <Button
                        variant="destructive"
                        onClick={() => setShowForceDialog(true)}
                        disabled={migrating}
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Force Apply ({riskyDiffs.length} risky)
                      </Button>
                    )}
                    <Button
                      onClick={handleSync}
                      disabled={migrating || !hasSafeChanges}
                    >
                      {migrating ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Applying…
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4 mr-2" />
                          Sync Schema
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Migration Result */}
                {migrationResult && (
                  <div
                    className={`p-4 rounded-lg border ${
                      migrationResult.success ? 'status-info' : 'status-error'
                    }`}
                  >
                    <p className="font-semibold mb-2">{migrationResult.message}</p>
                    {(migrationResult.tables_created > 0 ||
                      migrationResult.columns_added > 0 ||
                      migrationResult.indexes_created > 0) && (
                      <ul className="text-sm space-y-0.5 mb-2 text-muted-foreground">
                        {migrationResult.tables_created > 0 && (
                          <li>✓ {migrationResult.tables_created} table(s) created</li>
                        )}
                        {migrationResult.columns_added > 0 && (
                          <li>✓ {migrationResult.columns_added} column(s) added</li>
                        )}
                        {migrationResult.indexes_created > 0 && (
                          <li>✓ {migrationResult.indexes_created} index(es) created</li>
                        )}
                      </ul>
                    )}
                    {migrationResult.column_changes_applied.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-bold uppercase text-muted-foreground mb-1">
                          Column changes applied:
                        </p>
                        <ul className="text-sm space-y-0.5 text-muted-foreground">
                          {migrationResult.column_changes_applied.map(c => (
                            <li key={c}>✓ {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {migrationResult.column_changes_skipped.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-bold uppercase text-warning-foreground mb-1">
                          Skipped (risky — use Force Apply):
                        </p>
                        <ul className="text-sm space-y-0.5 text-warning-foreground">
                          {migrationResult.column_changes_skipped.map(c => (
                            <li key={c}>⚠ {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {migrationResult.errors.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase text-destructive mb-1">
                          Errors:
                        </p>
                        <ul className="text-sm space-y-0.5 text-error-foreground">
                          {migrationResult.errors.map(e => (
                            <li key={e}>✗ {e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* RBAC Seeding Card */}
        <Card>
          <CardHeader>
            <CardTitle>RBAC System Seeding</CardTitle>
            <CardDescription>
              Initialize or update the Role-Based Access Control system with default
              permissions and roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="status-info">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>About RBAC Seeding</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>This process will:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
                    <li>Create or update all default permissions for system resources</li>
                    <li>Create system roles (admin, operator, network_engineer, viewer)</li>
                    <li>Assign appropriate permissions to each role</li>
                    <li>
                      Migrate any legacy permissions (network.inventory → general.inventory)
                    </li>
                  </ul>
                  <p className="mt-2 font-medium">
                    Safe to run multiple times — existing data will be preserved.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remove-existing"
                    checked={removeExisting}
                    onChange={e => setRemoveExisting(e.target.checked)}
                    className="w-4 h-4 text-destructive border-border rounded focus:ring-destructive"
                    disabled={seeding}
                  />
                  <label
                    htmlFor="remove-existing"
                    className="text-sm font-medium text-muted-foreground cursor-pointer select-none"
                  >
                    Remove all existing RBAC data before seeding
                  </label>
                </div>
                {removeExisting && (
                  <Alert className="status-error">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warning: Destructive Operation</AlertTitle>
                    <AlertDescription className="space-y-1">
                      <p className="font-medium">This will permanently delete:</p>
                      <ul className="list-disc list-inside ml-2 text-sm">
                        <li>All user-role assignments</li>
                        <li>All user-permission overrides</li>
                        <li>All roles (including system roles)</li>
                        <li>All permissions</li>
                      </ul>
                      <p className="mt-2 font-medium">
                        Users will need to be reassigned to roles after this operation.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    Run this after database changes or when adding new features that
                    require permissions.
                  </div>
                  <Button
                    onClick={handleSeedRbac}
                    disabled={seeding}
                    variant={removeExisting ? 'destructive' : 'default'}
                  >
                    {seeding ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        {removeExisting ? 'Removing & Reseeding…' : 'Seeding RBAC…'}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {removeExisting ? 'Remove & Reseed RBAC' : 'Seed RBAC System'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Force Apply Confirmation Dialog */}
        <Dialog open={showForceDialog} onOpenChange={setShowForceDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Force Apply Risky Changes
              </DialogTitle>
              <DialogDescription>
                The following changes may cause data loss or fail on rows with incompatible
                values. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="border border-error-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-error">
                      <TableHead className="text-xs">Column</TableHead>
                      <TableHead className="text-xs">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskyDiffs.map(cd => (
                      <TableRow key={`${cd.table}-${cd.column}`}>
                        <TableCell className="text-sm font-mono">
                          {cd.table}.{cd.column}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {columnDiffDescription(cd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="force-confirm"
                  checked={forceConfirmed}
                  onChange={e => setForceConfirmed(e.target.checked)}
                  className="w-4 h-4 text-destructive border-border rounded focus:ring-destructive"
                />
                <label
                  htmlFor="force-confirm"
                  className="text-sm font-medium text-muted-foreground cursor-pointer select-none"
                >
                  I understand this may cause irreversible data loss
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForceDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!forceConfirmed}
                onClick={handleForceConfirm}
              >
                Apply Risky Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* RBAC Seed Confirmation Dialog */}
        <Dialog open={showSeedDialog} onOpenChange={setShowSeedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Seed RBAC System?</DialogTitle>
              <DialogDescription>
                The database was synchronized successfully. Would you like to seed the
                RBAC system with default permissions and roles?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSeedDialog(false)}>
                Skip
              </Button>
              <Button onClick={handleSeedRbac}>
                Seed RBAC
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* RBAC Seed Output Modal */}
        <Dialog open={showSeedOutputModal} onOpenChange={setShowSeedOutputModal}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {seedResult?.success ? '✅ RBAC Seeding Complete' : '❌ RBAC Seeding Failed'}
              </DialogTitle>
              <DialogDescription>{seedResult?.message}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {/* Deliberately kept dark: this is a terminal/console output block.
                  No semantic token exists for "console output" background; the same
                  bg-gray-900/text-gray-100 pattern is used unmigrated across ~10 other
                  features (job results, snapshot viewers, etc.) so a token should be
                  introduced codebase-wide rather than diverging here. */}
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap">
                {seedResult?.output || 'No output available'}
              </pre>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowSeedOutputModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
