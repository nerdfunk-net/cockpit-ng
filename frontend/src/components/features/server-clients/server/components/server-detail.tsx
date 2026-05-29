'use client'

import { useState } from 'react'
import { FileJson, HardDrive, Server, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import type { ServerResponse } from '../types'

interface MountEntry {
  mount: string
  device: string
  fstype: string
  size_total: number
  size_available: number
}

interface ServerDetailProps {
  server: ServerResponse
  onShowFacts: () => void
  onRemove: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)} MB`
}

function FactRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-800 truncate">
        {value ?? <span className="text-gray-400 italic">—</span>}
      </span>
    </div>
  )
}

export function ServerDetail({ server, onShowFacts, onRemove }: ServerDetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const facts = server.ansible_facts
  const ansibleFacts = facts?.ansible_facts as Record<string, unknown> | undefined
  const rawFacts = facts?.facts as Record<string, unknown> | undefined

  const mounts: MountEntry[] = (
    (ansibleFacts?.mounts as MountEntry[] | undefined) ??
    (rawFacts?.ansible_mounts as MountEntry[] | undefined) ??
    []
  )

  const distribution = [server.distribution_release, server.distribution_version]
    .filter(Boolean)
    .join(' / ')

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Server className="h-4 w-4" />
          <span className="text-sm font-medium">{server.hostname}</span>
        </div>
        <button
          onClick={onShowFacts}
          title="Show Ansible Facts"
          className="flex items-center gap-1.5 text-xs text-blue-100 hover:text-white transition-colors"
        >
          <FileJson className="h-4 w-4" />
          <span>Show Facts</span>
        </button>
      </div>

      {/* Facts grid */}
      <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <FactRow label="Hostname" value={server.hostname} />
          <FactRow label="Primary IPv4" value={server.primary_ipv4} />
          <FactRow label="Interface" value={server.primary_interface} />
          <FactRow label="OS Family" value={server.os_family} />
          <FactRow label="Architecture" value={server.architecture} />
          <FactRow label="Distribution" value={distribution || null} />
          <FactRow label="CPUs" value={server.processor_count} />
          <FactRow label="RAM" value={server.memtotal_mb != null ? `${server.memtotal_mb} MB` : null} />
          <FactRow label="Disks" value={server.disk_count} />
          <FactRow label="Location" value={server.location} />
          <FactRow label="Contact" value={server.contact} />
          <FactRow label="Nautobot UUID" value={server.nautobot_uuid} />
        </div>

        {/* Mounts table */}
        {mounts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Mount Points</span>
            </div>
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Device</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">Mount</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">FS</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">Total</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {mounts.map((m, i) => (
                    <tr
                      key={m.mount}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-3 py-2 font-mono text-gray-600">{m.device}</td>
                      <td className="px-3 py-2 font-mono text-gray-800">{m.mount}</td>
                      <td className="px-3 py-2 text-gray-600">{m.fstype}</td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {m.size_total ? formatBytes(m.size_total) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {m.size_available ? formatBytes(m.size_available) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Remove Server */}
        <div className="pt-2 border-t border-gray-200">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Server
          </Button>
        </div>
      </div>

      {/* Confirm removal dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove server?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{server.hostname}</strong> and all its data
              from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
