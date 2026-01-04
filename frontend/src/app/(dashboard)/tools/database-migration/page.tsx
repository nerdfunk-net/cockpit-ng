'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Database, AlertTriangle, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'

// Types for API response
interface MissingColumn {
    table: string
    column: string
    type: string
    nullable: boolean
    default: string | null
}

interface SchemaStatus {
    is_up_to_date: boolean
    missing_tables: string[]
    missing_columns: MissingColumn[]
}

interface MigrationResponse {
    success: boolean
    message: string
    changes: string[]
    errors: string[]
}

interface SeedRbacResponse {
    success: boolean
    message: string
    output: string
}

export default function DatabaseMigrationPage() {
    const { apiCall } = useApi()
    const [status, setStatus] = useState<SchemaStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [migrating, setMigrating] = useState(false)
    const [migrationResult, setMigrationResult] = useState<MigrationResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    // RBAC seeding state
    const [showSeedDialog, setShowSeedDialog] = useState(false)
    const [seedResult, setSeedResult] = useState<SeedRbacResponse | null>(null)
    const [showSeedOutputModal, setShowSeedOutputModal] = useState(false)
    const [seeding, setSeeding] = useState(false)

    const fetchStatus = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await apiCall<SchemaStatus>('tools/schema/status')
            setStatus(data)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred fetching status'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }, [apiCall])

    const handleMigrate = async () => {
        setMigrating(true)
        setMigrationResult(null)
        try {
            const data = await apiCall<MigrationResponse>('tools/schema/migrate', {
                method: 'POST'
            })
            setMigrationResult(data)
            if (data.success) {
                await fetchStatus() // Refresh status on success
                // Show dialog asking if user wants to seed RBAC
                setShowSeedDialog(true)
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Network or server error during migration'
            setMigrationResult({
                success: false,
                message: errorMessage,
                changes: [],
                errors: [errorMessage]
            })
        } finally {
            setMigrating(false)
        }
    }

    const handleSeedRbac = async () => {
        setShowSeedDialog(false)
        setSeedResult(null)
        setSeeding(true)
        try {
            const data = await apiCall<SeedRbacResponse>('tools/rbac/seed', {
                method: 'POST'
            })
            setSeedResult(data)
            setShowSeedOutputModal(true)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to seed RBAC'
            setSeedResult({
                success: false,
                message: errorMessage,
                output: `Error: ${errorMessage}`
            })
            setShowSeedOutputModal(true)
        } finally {
            setSeeding(false)
        }
    }

    useEffect(() => {
        fetchStatus()
    }, [fetchStatus])

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/tools">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 text-white shadow-sm">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Database Migration</h1>
                            <p className="text-gray-500 text-sm">Compare and synchronize database schema</p>
                        </div>
                    </div>
                </div>

                {/* Status Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Schema Status</CardTitle>
                            <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                        <CardDescription>
                            Comparison between define models and active database tables.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <Alert className="mb-4 border-red-200 bg-red-50 text-red-900">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription className="text-red-800">{error}</AlertDescription>
                            </Alert>
                        )}

                        {loading ? (
                            <div className="flex justify-center p-8">
                                <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                            </div>
                        ) : status ? (
                            <div className="space-y-6">
                                <div className={`p-4 rounded-lg flex items-center gap-3 ${status.is_up_to_date ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                    {status.is_up_to_date ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                                    <div>
                                        <p className="font-semibold text-lg">
                                            {status.is_up_to_date ? 'Database is up to date' : 'Schema differences detected'}
                                        </p>
                                        <p className="text-sm opacity-90">
                                            {status.is_up_to_date
                                                ? 'All tables and columns match the application definition.'
                                                : `${status.missing_tables.length} missing tables and ${status.missing_columns.length} missing columns found.`}
                                        </p>
                                    </div>
                                </div>

                                {!status.is_up_to_date && (
                                    <div className="space-y-6">
                                        {/* Missing Tables */}
                                        {status.missing_tables.length > 0 && (
                                            <div>
                                                <h3 className="font-medium mb-3 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                                    Missing Tables ({status.missing_tables.length})
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                    {status.missing_tables.map(table => (
                                                        <div key={table} className="bg-white border rounded px-3 py-2 text-sm font-mono text-gray-600 shadow-sm">
                                                            {table}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Missing Columns */}
                                        {status.missing_columns.length > 0 && (
                                            <div>
                                                <h3 className="font-medium mb-3 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                    Missing Columns ({status.missing_columns.length})
                                                </h3>
                                                <div className="border rounded-lg overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-gray-50">
                                                                <TableHead>Table</TableHead>
                                                                <TableHead>Column</TableHead>
                                                                <TableHead>Type</TableHead>
                                                                <TableHead>Details</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {status.missing_columns.map((col) => (
                                                                <TableRow key={`${col.table}-${col.column}`}>
                                                                    <TableCell className="font-medium">{col.table}</TableCell>
                                                                    <TableCell className="font-mono text-blue-600">{col.column}</TableCell>
                                                                    <TableCell className="text-gray-500">{col.type}</TableCell>
                                                                    <TableCell className="text-xs text-gray-500">
                                                                        {col.nullable ? <Badge variant="outline">Nullable</Badge> : <Badge variant="secondary">Required</Badge>}
                                                                        {col.default && <span className="ml-2">Default: {col.default}</span>}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-4 border-t flex justify-end">
                                            <Button onClick={handleMigrate} disabled={migrating} className="bg-blue-600 hover:bg-blue-700">
                                                {migrating ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                        Applying Changes...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Database className="w-4 h-4 mr-2" />
                                                        Update Database Structure
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Migration Result Report */}
                                {migrationResult && (
                                    <div className={`mt-6 p-4 rounded-lg border ${migrationResult.success ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                                        <h3 className={`font-semibold mb-2 ${migrationResult.success ? 'text-blue-800' : 'text-red-800'}`}>
                                            {migrationResult.message}
                                        </h3>
                                        {migrationResult.changes.length > 0 && (
                                            <div className="mb-2">
                                                <p className="text-xs font-bold uppercase text-gray-500 mb-1">Changes Applied:</p>
                                                <ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
                                                    {migrationResult.changes.map((change) => (
                                                        <li key={change}>{change}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {migrationResult.errors.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold uppercase text-red-500 mb-1">Errors:</p>
                                                <ul className="list-disc list-inside text-sm space-y-1 text-red-700">
                                                    {migrationResult.errors.map((err) => (
                                                        <li key={err}>{err}</li>
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

                {/* RBAC Seeding Card - Always available */}
                <Card>
                    <CardHeader>
                        <CardTitle>RBAC System Seeding</CardTitle>
                        <CardDescription>
                            Initialize or update the Role-Based Access Control system with default permissions and roles.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Alert className="border-blue-200 bg-blue-50">
                                <AlertTriangle className="h-4 w-4 text-blue-600" />
                                <AlertTitle>About RBAC Seeding</AlertTitle>
                                <AlertDescription className="text-blue-800 space-y-2">
                                    <p>This process will:</p>
                                    <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
                                        <li>Create or update all default permissions for system resources</li>
                                        <li>Create system roles (admin, operator, network_engineer, viewer)</li>
                                        <li>Assign appropriate permissions to each role</li>
                                        <li>Migrate any legacy permissions (network.inventory → general.inventory)</li>
                                    </ul>
                                    <p className="mt-2 font-medium">Safe to run multiple times - existing data will be preserved.</p>
                                </AlertDescription>
                            </Alert>

                            <div className="flex justify-between items-center pt-2">
                                <div className="text-sm text-gray-600">
                                    Run this after database changes or when adding new features that require permissions.
                                </div>
                                <Button 
                                    onClick={handleSeedRbac} 
                                    disabled={seeding}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {seeding ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Seeding RBAC...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Seed RBAC System
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Seed RBAC Confirmation Dialog */}
                <Dialog open={showSeedDialog} onOpenChange={setShowSeedDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Seed RBAC System?</DialogTitle>
                            <DialogDescription>
                                The database migration was successful. Would you like to seed the RBAC system with default permissions and roles?
                                This will ensure all permissions are up-to-date with the new database schema.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowSeedDialog(false)}>
                                Skip
                            </Button>
                            <Button onClick={handleSeedRbac} className="bg-blue-600 hover:bg-blue-700">
                                Seed RBAC
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Seed RBAC Output Modal */}
                <Dialog open={showSeedOutputModal} onOpenChange={setShowSeedOutputModal}>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                        <DialogHeader>
                            <DialogTitle>
                                {seedResult?.success ? '✅ RBAC Seeding Complete' : '❌ RBAC Seeding Failed'}
                            </DialogTitle>
                            <DialogDescription>
                                {seedResult?.message}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto">
                            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap">
                                {seedResult?.output || 'No output available'}
                            </pre>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => setShowSeedOutputModal(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
