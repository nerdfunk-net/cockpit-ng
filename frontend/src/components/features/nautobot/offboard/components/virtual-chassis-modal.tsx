'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'
import type {
  DeviceVirtualChassisStatus,
  VirtualChassisDecision,
} from '@/types/features/nautobot/offboard'

type Step = 'choose_action' | 'choose_master'

interface VirtualChassisModalProps {
  isOpen: boolean
  deviceId: string
  deviceName: string
  status: DeviceVirtualChassisStatus
  onDecide: (decision: VirtualChassisDecision) => void
  onCancel: () => void
}

export function VirtualChassisModal({
  isOpen,
  deviceId,
  deviceName,
  status,
  onDecide,
  onCancel,
}: VirtualChassisModalProps) {
  const [step, setStep] = useState<Step>('choose_action')
  const [selectedMasterId, setSelectedMasterId] = useState<string>('')
  const [renameNewMaster, setRenameNewMaster] = useState(false)
  const [newMasterName, setNewMasterName] = useState('')

  const vc = status.virtual_chassis
  const memberCount = vc?.members.length ?? 0
  const otherMembers = vc?.members.filter(m => m.id !== deviceId) ?? []

  function handleRemoveAll() {
    if (!vc) return
    onDecide({
      action: 'remove_all',
      virtual_chassis_id: vc.id,
      chassis_member_ids: vc.members.map(m => m.id),
    })
    setStep('choose_action')
    setSelectedMasterId('')
  }

  function handleRemoveSingle() {
    if (!vc) return
    if (status.is_master && otherMembers.length > 0) {
      setStep('choose_master')
    } else {
      onDecide({
        action: 'remove_single',
        virtual_chassis_id: vc.id,
      })
      setStep('choose_action')
      setSelectedMasterId('')
    }
  }

  function handleMasterSelect(id: string) {
    setSelectedMasterId(id)
    if (renameNewMaster) {
      const member = otherMembers.find(m => m.id === id)
      setNewMasterName(member?.name ?? '')
    }
  }

  function handleRenameToggle(checked: boolean) {
    setRenameNewMaster(checked)
    if (checked && selectedMasterId) {
      const member = otherMembers.find(m => m.id === selectedMasterId)
      setNewMasterName(member?.name ?? '')
    } else {
      setNewMasterName('')
    }
  }

  function handleConfirmNewMaster() {
    if (!vc || !selectedMasterId) return
    onDecide({
      action: 'remove_single',
      virtual_chassis_id: vc.id,
      new_master_id: selectedMasterId,
      new_master_name:
        renameNewMaster && newMasterName.trim() ? newMasterName.trim() : undefined,
    })
    setStep('choose_action')
    setSelectedMasterId('')
    setRenameNewMaster(false)
    setNewMasterName('')
  }

  function handleCancel() {
    setStep('choose_action')
    setSelectedMasterId('')
    setRenameNewMaster(false)
    setNewMasterName('')
    onCancel()
  }

  if (!vc) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Virtual Chassis Detected
          </DialogTitle>
        </DialogHeader>

        {step === 'choose_action' && (
          <>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Device <strong className="text-foreground">{deviceName}</strong>
                  {status.is_master ? ' is the master of' : ' is a member of'} virtual chassis{' '}
                  <strong className="text-foreground">{vc.name}</strong> with{' '}
                  <strong className="text-foreground">{memberCount}</strong>{' '}
                  {memberCount === 1 ? 'member' : 'members'}.
                </p>
                <p>How would you like to proceed?</p>
              </div>
            </DialogDescription>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="destructive" onClick={handleRemoveAll}>
                Remove entire chassis ({memberCount} devices)
              </Button>
              <Button variant="outline" onClick={handleRemoveSingle}>
                Remove only this device
              </Button>
              <Button variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {step === 'choose_master' && (
          <>
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">{deviceName}</strong> is the current master.
                  Select a new master for virtual chassis{' '}
                  <strong className="text-foreground">{vc.name}</strong>:
                </p>
              </div>
            </DialogDescription>

            <RadioGroup
              value={selectedMasterId}
              onValueChange={handleMasterSelect}
              className="py-2 space-y-2"
            >
              {otherMembers.map(member => (
                <div key={member.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={member.id} id={member.id} />
                  <Label htmlFor={member.id}>{member.name}</Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="rename-new-master"
                checked={renameNewMaster}
                onCheckedChange={(checked) => handleRenameToggle(checked === true)}
              />
              <Label htmlFor="rename-new-master">Rename new master</Label>
            </div>

            {renameNewMaster && selectedMasterId && (
              <div className="space-y-1">
                <Label htmlFor="new-master-name">New device name</Label>
                <Input
                  id="new-master-name"
                  value={newMasterName}
                  onChange={(e) => setNewMasterName(e.target.value)}
                  placeholder="Enter new device name"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('choose_action')
                  setRenameNewMaster(false)
                  setNewMasterName('')
                }}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmNewMaster}
                disabled={!selectedMasterId || (renameNewMaster && !newMasterName.trim())}
              >
                Confirm New Master & Remove Device
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
