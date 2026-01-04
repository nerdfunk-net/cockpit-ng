# Cockpit-NG UI Style Guide

This document describes the standard UI patterns and styling conventions used throughout the Cockpit-NG application.

## Color Scheme

### Primary Colors
- **Blue Gradient Headers**: `from-blue-400/80 to-blue-500/80`
- **Blue Text Accent**: `text-blue-100` (for header descriptions)
- **Content Gradient**: `from-white to-gray-50`

### Status Colors
- **Success**: Green (`text-green-600`, `border-green-200`, `bg-green-50`)
- **Error/Destructive**: Red (`text-red-600`)
- **Warning**: Amber/Yellow
- **Info**: Blue (`text-blue-800`, `border-blue-200`, `bg-blue-50`)

## UI Patterns

### 1. Gradient Header Section Pattern (Recommended)

Use this pattern for main content sections, form containers, and feature-specific tabs. This is the **preferred pattern** for most UI sections.

```tsx
<div className="shadow-lg border-0 p-0 bg-white rounded-lg">
  <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium">Section Title</span>
    </div>
    <div className="text-xs text-blue-100">
      Optional description or helper text
    </div>
  </div>
  <div className="p-6 bg-gradient-to-b from-white to-gray-50">
    {/* Content goes here */}
  </div>
</div>
```

**When to use:**
- Command execution panels
- Template selection sections
- Configuration forms
- Main feature sections in tabs
- Any section requiring visual prominence

**Examples:**
- `frontend/src/components/features/network/snapshots/tabs/commands-tab.tsx`
- `frontend/src/components/features/network/automation/netmiko/tabs/command-execution-tab.tsx`
- `frontend/src/components/features/general/inventory/tabs/inventory-generation-tab.tsx`

### 2. Plain Card Pattern

Use the standard shadcn Card component for simpler, less prominent sections.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Section Title</CardTitle>
    <CardDescription>
      Section description
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content goes here */}
  </CardContent>
</Card>
```

**When to use:**
- Simple information display
- Less prominent UI sections
- Nested content within gradient sections
- Settings dialogs

### 3. Device Selection Tab Pattern

Device selection uses a unified component with consistent styling.

```tsx
<DeviceSelectionTab
  selectedDeviceIds={selectedDeviceIds}
  selectedDevices={selectedDevices}
  onDevicesSelected={handleDevicesSelected}
  onSelectionChange={handleSelectionChange}
  nextStepMessage="Switch to the next tab to continue..."
  alertStyle="success"
/>
```

**Styling:**
- No colored headers
- Uses `space-y-6` for spacing
- Success alerts use green color scheme
- Device selector component handles its own styling

## Layout Spacing

### Tab Content Wrapper
All tab content should be wrapped in a div with `space-y-6` for consistent vertical spacing:

```tsx
return (
  <div className="space-y-6">
    {/* Multiple sections with automatic spacing */}
  </div>
)
```

### Content Padding
- **Section content**: `p-6` (24px padding all around)
- **Compact sections**: `py-2 px-4` (8px vertical, 16px horizontal)
- **Header padding**: `py-2 px-4`

### Gaps and Spacing
- **Flex gaps**: `gap-4` (16px) or `gap-2` (8px) for buttons/controls
- **Form field spacing**: `space-y-4` or `space-y-2`
- **Grid spacing**: `space-x-2`, `space-x-3`, `space-x-4` depending on content

## Typography

### Headers
- **Section titles**: `text-sm font-medium` (in gradient headers)
- **Card titles**: Use `CardTitle` component (default styling)
- **Descriptions**: `text-xs text-blue-100` (in gradient headers) or `CardDescription` component

### Content Text
- **Labels**: `text-sm` with appropriate weight
- **Body text**: Default text size
- **Helper text**: `text-sm text-gray-600` or `text-muted-foreground`
- **Empty states**: `text-gray-500` with `text-lg font-medium` for main message

## Borders and Shadows

### Shadows
- **Section containers**: `shadow-lg`
- **Cards**: Default card shadow
- **Elevated elements**: `shadow-sm` or `shadow-md`

### Borders
- **No visible borders** on gradient sections: `border-0`
- **Rounded corners**: `rounded-lg` for containers, `rounded-t-lg` for headers
- **Internal borders**: `border border-gray-200` or similar for form elements

## Component-Specific Patterns

### Buttons in Headers
Place action buttons in the right side of gradient headers:

```tsx
<div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
  <div className="flex items-center space-x-2">
    <span className="text-sm font-medium">Title</span>
  </div>
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm">Action</Button>
  </div>
</div>
```

### Form Layouts
Use consistent spacing for form fields:

```tsx
<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="field">Field Label</Label>
    <Input id="field" />
  </div>
</div>
```

### Empty States
Center-aligned with consistent messaging:

```tsx
<div className="text-center py-12 text-gray-500">
  <p className="text-lg font-medium">Main message</p>
  <p className="text-sm mt-1">Helper text or call to action</p>
</div>
```

## Alerts and Notifications

### Success Alerts
```tsx
<Alert className="bg-green-50 border-green-200">
  <CheckCircle2 className="h-4 w-4 text-green-600" />
  <AlertDescription className="text-green-800">
    Success message
  </AlertDescription>
</Alert>
```

### Info Alerts
```tsx
<Alert className="bg-blue-50 border-blue-200">
  <AlertCircle className="h-4 w-4 text-blue-600" />
  <AlertDescription className="text-blue-800">
    Info message
  </AlertDescription>
</Alert>
```

## Migration Notes

When updating older components:
1. Replace `Card` with gradient header pattern for main sections
2. Remove `bg-blue-100 border-b` from old CardHeader styling
3. Add `space-y-6` wrapper around tab content
4. Use `p-6 bg-gradient-to-b from-white to-gray-50` for content areas
5. Ensure consistent `rounded-t-lg` on headers, `rounded-lg` on containers

## Do's and Don'ts

### ✅ Do
- Use the gradient header pattern for main feature sections
- Maintain consistent spacing with `space-y-6`
- Use semantic color classes (success, error, info)
- Keep padding consistent across similar components

### ❌ Don't
- Mix plain Cards with gradient sections in the same feature
- Use `bg-blue-100` for headers (outdated pattern)
- Add explicit padding classes like `pt-6` when wrapper already has padding
- Use different header styles within the same feature area

## Related Files

**Component Locations:**
- Shared components: `frontend/src/components/shared/`
- Feature components: `frontend/src/components/features/`
- UI primitives: `frontend/src/components/ui/`

**Reference Implementations:**
- Snapshots feature: `frontend/src/components/features/network/snapshots/`
- Netmiko automation: `frontend/src/components/features/network/automation/netmiko/`
- Inventory generation: `frontend/src/components/features/general/inventory/`
