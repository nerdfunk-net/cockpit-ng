export type NautobotDataType = 'locations' | 'tags' | 'custom-fields' | 'statuses' | 'roles' | 'namespaces'
export type InventoryMetadataType = 'locations' | 'tags' | 'custom_fields' | 'statuses' | 'roles'

export interface AddVariableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (name: string, value: string) => void
  existingVariableNames: string[]
  category: string
  inventoryId: number | null
}
