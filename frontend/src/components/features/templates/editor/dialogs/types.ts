export type NautobotDataType = 'locations' | 'tags' | 'custom-fields' | 'statuses' | 'roles' | 'namespaces'
export type InventoryMetadataType = 'locations' | 'tags' | 'custom_fields' | 'statuses' | 'roles'

export interface VariableDefinition {
  name: string
  value: string
  type: 'custom' | 'nautobot' | 'yaml' | 'inventory'
  metadata?: {
    // Nautobot-specific
    nautobot_source?: NautobotDataType
    // YAML-specific
    yaml_file_path?: string
    yaml_file_id?: number
    // Inventory-specific
    inventory_id?: number
    inventory_data_type?: InventoryMetadataType
    inventory_custom_field?: string
  }
}

export interface AddVariableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (variable: VariableDefinition) => void
  existingVariableNames: string[]
  category: string
  inventoryId: number | null
}
