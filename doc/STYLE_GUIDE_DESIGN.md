# Cockpit-NG Design System Guide

**Version:** 2.0  
**Last Updated:** 2026-02-12  
**Purpose:** Visual design patterns and UI component specifications for Cockpit-NG applications.

> **Note:** This is a design-focused extract from the comprehensive [STYLE_GUIDE.md](STYLE_GUIDE.md). For complete implementation guidance including code architecture, hooks, and API patterns, refer to the full style guide.

---

## Table of Contents

1. [Page Structure & Layout](#1-page-structure--layout)
2. [Content Section Patterns](#2-content-section-patterns)
3. [Tabbed Interfaces](#3-tabbed-interfaces)
4. [Color System](#4-color-system)
5. [Spacing & Layout](#5-spacing--layout)
6. [Typography System](#6-typography-system)
7. [Components & Patterns](#7-components--patterns)
8. [Loading States](#8-loading-states)
9. [Empty States](#9-empty-states)
10. [Dialogs & Modals](#10-dialogs--modals)
11. [Common Icons Reference](#11-common-icons-reference)
12. [Common Mistakes to Avoid](#12-common-mistakes-to-avoid)
13. [Quick Reference Templates](#13-quick-reference-templates)
14. [Structural Consistency Checklist (Cross-App)](#14-structural-consistency-checklist-cross-app)

---

## Reference Applications

- **Primary Reference:** CheckMK Sync Devices (`/checkmk/sync-devices`)
- **Tabbed Interface Reference:** Netmiko Command Execution (`/network/automation/netmiko`)

---

## 1. Page Structure & Layout

### 1.1 Root Container

Every page should start with a root container that provides consistent vertical spacing:

```tsx
export default function MyPage() {
  return (
    <div className="space-y-6">
      {/* All page sections go here */}
    </div>
  )
}
```

**Key Properties:**
- `space-y-6` - 24px vertical spacing between all direct children
- This creates consistent rhythm throughout the page

### 1.2 Page Header Pattern

The page header is the first thing users see. Use this exact pattern:

```tsx
<div className="flex items-center justify-between">
  {/* Left Side: Title and Icon */}
  <div className="flex items-center space-x-3">
    <div className="bg-green-100 p-2 rounded-lg">
      <RefreshCw className="h-6 w-6 text-green-600" />
    </div>
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Page Title</h1>
      <p className="text-gray-600 mt-1">Brief description of the page purpose</p>
    </div>
  </div>

  {/* Right Side: Quick Actions (Optional) */}
  <div className="flex items-center space-x-2">
    <Button variant="outline">Action</Button>
  </div>
</div>
```

**Icon Box Colors** (choose based on feature):
- Green: `bg-green-100` + `text-green-600` (sync, refresh, success-oriented features)
- Blue: `bg-blue-100` + `text-blue-600` (automation, commands, general features)
- Purple: `bg-purple-100` + `text-purple-600` (settings, configuration)
- Orange: `bg-orange-100` + `text-orange-600` (warnings, monitoring)
- Red: `bg-red-100` + `text-red-600` (critical operations, delete actions)

**Typography:**
- Main title: `text-3xl font-bold text-gray-900`
- Description: `text-gray-600 mt-1`
- Icon size: `h-6 w-6`

---

## 2. Content Section Patterns

### 2.1 Gradient Header Section (Primary Pattern)

This is the **primary pattern** for all prominent content sections. Use this for:
- Main feature sections
- Command execution panels
- Configuration forms
- Data input areas
- Any section requiring visual prominence

```tsx
<div className="shadow-lg border-0 p-0 bg-white rounded-lg">
  {/* Header with gradient */}
  <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
    <div className="flex items-center space-x-2">
      <Terminal className="h-4 w-4" />
      <span className="text-sm font-medium">Section Title</span>
    </div>
    <div className="text-xs text-blue-100">
      Optional helper text or description
    </div>
  </div>

  {/* Content area with gradient background */}
  <div className="p-6 bg-gradient-to-b from-white to-gray-50">
    {/* Your content here */}
  </div>
</div>
```

**Key Properties:**
- Container: `shadow-lg border-0 p-0 bg-white rounded-lg`
- Header gradient: `bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white`
- Header padding: `py-2 px-4`
- Header corners: `rounded-t-lg`
- Title: `text-sm font-medium`
- Helper text: `text-xs text-blue-100`
- Content padding: `p-6`
- Content gradient: `bg-gradient-to-b from-white to-gray-50`
- Icon size in header: `h-4 w-4`

### 2.2 Plain Card Pattern (Secondary Pattern)

Use standard shadcn Card components for less prominent sections:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Section Title</CardTitle>
    <CardDescription>Section description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

**When to Use:**
- Simple information display
- Nested content within gradient sections
- Settings dialogs
- Less prominent UI sections

---

## 3. Tabbed Interfaces

### 3.1 Tab Container Setup

For pages with multiple sections, use tabs:

```tsx
<Tabs defaultValue="devices" className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="devices">Devices</TabsTrigger>
    <TabsTrigger value="variables">Variables & Templates</TabsTrigger>
    <TabsTrigger value="commands">Execute</TabsTrigger>
  </TabsList>

  <TabsContent value="devices" className="space-y-6">
    {/* Tab content */}
  </TabsContent>

  <TabsContent value="variables" className="space-y-6">
    {/* Tab content */}
  </TabsContent>

  <TabsContent value="commands" className="space-y-6">
    {/* Tab content */}
  </TabsContent>
</Tabs>
```

**Key Properties:**
- TabsList: `grid w-full grid-cols-{n}` where n is the number of tabs
- TabsContent wrapper: `space-y-6` for consistent vertical spacing
- Default value should be the first logical step in the workflow

### 3.2 Tab Content Structure

Each tab should follow this pattern:

```tsx
<TabsContent value="mytab" className="space-y-6">
  {/* Alert if needed */}
  <Alert className="bg-blue-50 border-blue-200">
    <AlertDescription className="text-blue-800">
      Important information about this tab
    </AlertDescription>
  </Alert>

  {/* Main content section(s) using gradient header pattern */}
  <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
    <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
      {/* Header content */}
    </div>
    <div className="p-6 bg-gradient-to-b from-white to-gray-50">
      {/* Tab content */}
    </div>
  </div>

  {/* Additional sections as needed */}
</TabsContent>
```

---

## 4. Color System

### 4.1 Status Colors

Use semantic colors consistently:

| Status | Background | Border | Text | Use Case |
|--------|-----------|--------|------|----------|
| Success | `bg-green-50` | `border-green-200` | `text-green-600/800` | Success messages, completed tasks |
| Error | `bg-red-50` | `border-red-200` | `text-red-600/800` | Error messages, failed operations |
| Info | `bg-blue-50` | `border-blue-200` | `text-blue-600/800` | Informational messages, hints |
| Warning | `bg-amber-50` | `border-amber-200` | `text-amber-600/800` | Warnings, cautions |

### 4.2 Gradient Colors

**Blue Gradients (Primary):**
- Header: `from-blue-400/80 to-blue-500/80`
- Content: `from-white to-gray-50`
- Text on gradient: `text-white`
- Secondary text: `text-blue-100`

**Alternative Gradients** (use sparingly for variety):
- Green: `from-green-400/80 to-green-500/80`
- Purple: `from-purple-400/80 to-purple-500/80`
- Orange: `from-orange-400/80 to-orange-500/80`

### 4.3 Icon Box Colors

Icon boxes in headers follow this pattern:

```tsx
<div className="bg-{color}-100 p-2 rounded-lg">
  <IconComponent className="h-6 w-6 text-{color}-600" />
</div>
```

**Color Meanings:**
- **Green** (`green-100` / `green-600`): Sync, refresh, growth, positive actions
- **Blue** (`blue-100` / `blue-600`): Automation, commands, information, default
- **Purple** (`purple-100` / `purple-600`): Settings, configuration, customization
- **Orange** (`orange-100` / `orange-600`): Monitoring, alerts, attention
- **Red** (`red-100` / `red-600`): Destructive actions, critical operations

---

## 5. Spacing & Layout

### 5.1 Standard Spacing Scale

Use these spacing utilities consistently:

| Class | Pixels | Use Case |
|-------|--------|----------|
| `space-y-2` | 8px | Tight spacing (form labels, small groups) |
| `space-y-3` | 12px | Medium-tight spacing |
| `space-y-4` | 16px | Medium spacing (form fields, card content) |
| `space-y-6` | 24px | Large spacing (page sections, tab content) |
| `gap-2` | 8px | Flex/grid gaps (buttons, inline elements) |
| `gap-4` | 16px | Larger flex/grid gaps |

### 5.2 Padding Guidelines

**Content Areas:**
- Main content padding: `p-6` (24px all sides)
- Compact sections: `p-4` (16px all sides)
- Headers: `py-2 px-4` (8px vertical, 16px horizontal)
- Cards: Use default CardContent padding or `p-6`

**Containers:**
- Icon boxes: `p-2` (8px all sides)
- Alert boxes: `p-3` or `p-4`
- Form containers: `p-6`

### 5.3 Border Radius

- Primary containers: `rounded-lg` (8px)
- Header only: `rounded-t-lg` (top corners only)
- Icon boxes: `rounded-lg`
- Buttons: Use default shadcn button radius
- Cards: Use default shadcn card radius

---

## 6. Typography System

### 6.1 Headings

```tsx
{/* Page title */}
<h1 className="text-3xl font-bold text-gray-900">Main Page Title</h1>

{/* Page subtitle/description */}
<p className="text-gray-600 mt-1">Description text below title</p>

{/* Section title in gradient header */}
<span className="text-sm font-medium">Section Title</span>

{/* Helper text in gradient header */}
<div className="text-xs text-blue-100">Helper text</div>

{/* Card title - use CardTitle component */}
<CardTitle>Card Section Title</CardTitle>
```

### 6.2 Content Text

```tsx
{/* Labels */}
<Label className="text-sm">Field Label</Label>

{/* Body text */}
<p className="text-sm">Regular body text</p>

{/* Helper text */}
<p className="text-xs text-gray-500">Helper or description text</p>

{/* Muted text */}
<span className="text-muted-foreground">Less prominent text</span>
```

### 6.3 Special Text Styles

```tsx
{/* Empty states */}
<div className="text-center py-12 text-gray-500">
  <p className="text-lg font-medium">Main message</p>
  <p className="text-sm mt-1">Helper text</p>
</div>

{/* Alert text */}
<AlertDescription className="text-blue-800">
  Alert message text
</AlertDescription>

{/* Monospace (code, commands) */}
<code className="font-mono text-sm">show ip interface brief</code>
```

---

## 7. Components & Patterns

### 7.1 Alerts

**Info Alert:**
```tsx
<Alert className="bg-blue-50 border-blue-200">
  <AlertCircle className="h-4 w-4 text-blue-600" />
  <AlertDescription className="text-blue-800">
    Information message
  </AlertDescription>
</Alert>
```

**Success Alert:**
```tsx
<Alert className="bg-green-50 border-green-200">
  <CheckCircle2 className="h-4 w-4 text-green-600" />
  <AlertDescription className="text-green-800">
    Success message
  </AlertDescription>
</Alert>
```

**Error Alert:**
```tsx
<Alert className="bg-red-50 border-red-200">
  <XCircle className="h-4 w-4 text-red-600" />
  <AlertDescription className="text-red-800">
    Error message
  </AlertDescription>
</Alert>
```

**Warning Alert:**
```tsx
<Alert className="bg-amber-50 border-amber-200">
  <AlertTriangle className="h-4 w-4 text-amber-600" />
  <AlertDescription className="text-amber-800">
    Warning message
  </AlertDescription>
</Alert>
```

### 7.2 Form Layouts

```tsx
<div className="space-y-4">
  {/* Single field group */}
  <div className="space-y-2">
    <Label htmlFor="field">Field Label</Label>
    <Input id="field" placeholder="Enter value" />
    <p className="text-xs text-gray-500">Helper text</p>
  </div>

  {/* Another field group */}
  <div className="space-y-2">
    <Label htmlFor="field2">Another Field</Label>
    <Textarea id="field2" rows={4} />
  </div>
</div>
```

### 7.3 Button Groups

```tsx
{/* Horizontal button group */}
<div className="flex items-center gap-2">
  <Button variant="default">Primary Action</Button>
  <Button variant="outline">Secondary Action</Button>
  <Button variant="ghost">Tertiary Action</Button>
</div>

{/* Button with loading state */}
<Button disabled={isLoading}>
  {isLoading && (
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
  )}
  Action Text
</Button>
```

### 7.4 Toggle/Switch Patterns

```tsx
<div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm">
  <Switch
    id="option"
    checked={enabled}
    onCheckedChange={setEnabled}
  />
  <div className="flex-1">
    <Label htmlFor="option" className="text-sm font-medium cursor-pointer">
      Option Name
    </Label>
    <p className="text-xs text-gray-600 mt-0.5">
      Description of what this option does
    </p>
  </div>
</div>
```

### 7.5 Status Badges

```tsx
{/* Success status */}
<Badge className="bg-green-100 text-green-800 border-green-300">
  Active
</Badge>

{/* Info status */}
<Badge className="bg-blue-100 text-blue-800 border-blue-300">
  Pending
</Badge>

{/* Error status */}
<Badge className="bg-red-100 text-red-800 border-red-300">
  Failed
</Badge>

{/* Default status */}
<Badge variant="outline">
  Default
</Badge>
```

---

## 8. Loading States

### 8.1 Page Loading

```tsx
<div className="flex items-center justify-center h-64">
  <div className="text-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
    <p className="mt-2 text-sm text-muted-foreground">Loading data...</p>
  </div>
</div>
```

### 8.2 Inline Loading (Buttons)

```tsx
<Button disabled={isLoading}>
  {isLoading && (
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
  )}
  {isLoading ? 'Processing...' : 'Submit'}
</Button>
```

### 8.3 Section Loading

```tsx
<div className="p-6 bg-gradient-to-b from-white to-gray-50">
  {loading ? (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
      <span className="ml-2 text-sm text-gray-600">Loading...</span>
    </div>
  ) : (
    {/* Content */}
  )}
</div>
```

---

## 9. Empty States

### 9.1 No Data State

```tsx
<div className="text-center py-12 text-gray-500">
  <p className="text-lg font-medium">No data available</p>
  <p className="text-sm mt-1">Get started by clicking the button above</p>
</div>
```

### 9.2 No Selection State

```tsx
<Alert className="bg-blue-50 border-blue-200">
  <AlertCircle className="h-4 w-4 text-blue-600" />
  <AlertDescription className="text-blue-800">
    No devices selected. Please select devices in the <strong>Devices</strong> tab first.
  </AlertDescription>
</Alert>
```

### 9.3 Selected Items Display

```tsx
<div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
  <p className="text-sm text-blue-800">
    <strong>{selectedCount}</strong> item{selectedCount !== 1 ? 's' : ''} selected
  </p>
</div>
```

---

## 10. Dialogs & Modals

### 10.1 Dialog Structure

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface MyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: DataType | null
  onConfirm: () => void
}

export function MyDialog({ open, onOpenChange, data, onConfirm }: MyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            Description of what this dialog does.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Dialog content */}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 10.2 Confirmation Dialog

```tsx
export function ConfirmDialog({ 
  open, 
  onOpenChange, 
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm 
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button 
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 10.3 Error Dialog

```tsx
export function ErrorDialog({ open, onOpenChange, error }: ErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            {error?.title || 'Error'}
          </DialogTitle>
          <DialogDescription>{error?.message}</DialogDescription>
        </DialogHeader>
        
        {error?.details && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <ul className="space-y-1 text-sm text-red-800">
              {error.details.map((detail, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-600">•</span>
                  <span className="font-mono">{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 10.4 Dialog Size Classes

| Size | Class | Use Case |
|------|-------|----------|
| Small | `max-w-sm` | Simple confirmations |
| Medium | `max-w-md` | Standard dialogs |
| Large | `max-w-lg` | Forms with multiple fields |
| Extra Large | `max-w-2xl` | Complex content, tables |
| Full | `max-w-4xl` | Large data displays |

---

## 11. Common Icons Reference

Use Lucide React icons consistently:

| Icon | Use Case |
|------|----------|
| `RefreshCw` | Sync, refresh operations |
| `RotateCcw` | Reload, reset |
| `Terminal` | Commands, CLI |
| `Play` | Execute, run |
| `Square` | Stop |
| `Settings` | Configuration |
| `Server` | Devices, servers |
| `Network` | Network operations |
| `Download` | Export, download |
| `Upload` | Import, upload |
| `Plus` | Add, create |
| `Trash2` | Delete |
| `Pencil` | Edit |
| `Eye` | View, preview |
| `EyeOff` | Hide |
| `CheckCircle2` | Success |
| `XCircle` | Error, close |
| `AlertCircle` | Info, attention |
| `AlertTriangle` | Warning |
| `Loader2` | Loading (with `animate-spin`) |
| `ChevronDown` | Dropdown, expand |
| `ChevronRight` | Navigate, expand |
| `Search` | Search |
| `Filter` | Filter |
| `Copy` | Copy to clipboard |
| `Save` | Save |
| `FileText` | Files, documents |
| `FolderOpen` | Folders, directories |
| `GitBranch` | Git, version control |

**Icon Usage Pattern:**

```tsx
import { RefreshCw, Settings, Terminal } from 'lucide-react'

// In headers (page icon box)
<div className="bg-blue-100 p-2 rounded-lg">
  <Terminal className="h-6 w-6 text-blue-600" />
</div>

// In section headers
<Terminal className="h-4 w-4" />

// In buttons
<Button>
  <RefreshCw className="h-4 w-4 mr-2" />
  Refresh
</Button>

// Loading state
<Loader2 className="h-4 w-4 animate-spin" />
```

---

## 12. Common Mistakes to Avoid

### ❌ Design Don'ts

- Don't use `bg-blue-100` for headers (outdated pattern)
- Don't mix gradient sections with plain cards in the same feature
- Don't use inline styles or arbitrary colors
- Don't forget `space-y-6` wrapper around page content
- Don't use `pt-6` when parent already has padding
- Don't use different header styles within the same feature
- Don't create custom loading spinners (use standard pattern)
- Don't build UI from scratch when shadcn components exist

### ✅ Design Do's

- Use gradient header pattern for main feature sections
- Maintain consistent spacing with `space-y-6` and `space-y-4`
- Use semantic color classes (success, error, info, warning)
- Use shadcn UI components for all UI primitives
- Add loading and empty states to all data sections
- Use Lucide React icons consistently
- Follow the typography scale
- Test responsive layout on mobile devices
- Add proper accessibility attributes (ARIA labels)

---

## 13. Quick Reference Templates

### 13.1 Page Template (No Tabs)

```tsx
'use client'

import { useState } from 'react'
import { MyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MyPage() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <MyIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Page Title</h1>
            <p className="text-gray-600 mt-1">Brief description</p>
          </div>
        </div>
        <Button variant="outline">Quick Action</Button>
      </div>

      {/* Main Content Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <MyIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Section Title</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {/* Content */}
        </div>
      </div>
    </div>
  )
}
```

### 13.2 Page Template (With Tabs)

```tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MyIcon } from 'lucide-react'

export default function MyTabbedPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <MyIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Page Title</h1>
            <p className="text-gray-600 mt-1">Brief description</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tab1" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>

        <TabsContent value="tab1" className="space-y-6">
          {/* Tab 1 content with gradient sections */}
        </TabsContent>

        <TabsContent value="tab2" className="space-y-6">
          {/* Tab 2 content */}
        </TabsContent>

        <TabsContent value="tab3" className="space-y-6">
          {/* Tab 3 content */}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

## Design Checklist

Before considering your design implementation complete:

- [ ] **Root Container**: Uses `space-y-6` for consistent vertical spacing
- [ ] **Page Header**: Includes colored icon box, title, description, and optional actions
- [ ] **Section Headers**: Uses gradient pattern (`from-blue-400/80 to-blue-500/80`)
- [ ] **Content Areas**: Uses `p-6 bg-gradient-to-b from-white to-gray-50`
- [ ] **Colors**: Uses semantic colors (green/red/blue/amber) consistently
- [ ] **Typography**: Follows typography scale (text-3xl, text-sm, etc.)
- [ ] **Spacing**: Maintains standard spacing (space-y-6, gap-2, p-6)
- [ ] **Icons**: Lucide React icons with correct sizes (h-6 w-6 for page, h-4 w-4 for sections)
- [ ] **Loading States**: Shows spinner and message for all async operations
- [ ] **Empty States**: Displays helpful empty state messages
- [ ] **Alerts**: Uses proper alert styling with icons
- [ ] **Buttons**: Groups buttons with gap-2, includes loading states
- [ ] **Forms**: Uses space-y-4 for fields, space-y-2 for field groups
- [ ] **Tabs**: Uses grid layout, space-y-6 for tab content
- [ ] **Responsive**: Tests on mobile devices
- [ ] **Accessibility**: Includes proper ARIA labels

---

## Resources

**Component Library:**
- Shadcn UI: https://ui.shadcn.com

**Icon Library:**
- Lucide Icons: https://lucide.dev

**Reference Implementations:**
- CheckMK Sync Devices: `/frontend/src/components/features/checkmk/sync-devices/`
- Netmiko Automation: `/frontend/src/components/features/network/automation/netmiko/`

**Complete Guide:**
- Full Style Guide: [STYLE_GUIDE.md](STYLE_GUIDE.md) - includes code architecture, hooks, API patterns, and more

---

## 14. Structural Consistency Checklist (Cross-App)

When building a new page or aligning an existing page with the design system, verify these structural rules. These are the most common sources of visual inconsistency between apps.

### 14.1 Page-Level Structure

⚠️ **CRITICAL SPACING ISSUE** — This is the #1 source of visual misalignment when switching between pages:
- **WRONG:** `<div className="flex items-center space-x-3">` (3px gap)
- **CORRECT:** `<div className="flex items-center gap-4">` (16px gap)
- **Impact:** Using `space-x-3` causes the icon to appear positioned lower than in apps using `gap-4`, creating a flickering effect when users navigate between pages.

Every page **MUST** follow this exact wrapper pattern:

```tsx
export function MyPage() {
  return (
    <div className="space-y-6">
      {/* Page Header - OUTSIDE the form */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-{color}-100 p-2 rounded-lg">
            <Icon className="h-6 w-6 text-{color}-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Page Title</h1>
            <p className="text-muted-foreground mt-2">Description</p>
          </div>
        </div>
        {/* Optional: action buttons */}
      </div>

      {/* Form or content sections go here */}
      <form className="space-y-6">
        {/* Sections */}
      </form>
    </div>
  )
}
```

**Common mistakes to avoid:**

⚠️ **CRITICAL SPACING ISSUE #1** — Icon-to-Title Spacing:
- **WRONG:** `<div className="flex items-center space-x-3">` (3px gap)
- **CORRECT:** `<div className="flex items-center gap-4">` (16px gap)
- **Impact:** Using `space-x-3` causes visual misalignment when switching pages

⚠️ **CRITICAL SPACING ISSUE #2** — Title-to-Subtitle Spacing:
- **WRONG:** `<p className="text-gray-600 mt-1">...</p>`
- **CORRECT:** `<p className="text-muted-foreground mt-2">...</p>`
- **Impact:** Using `mt-1` creates insufficient spacing; makes pages look cramped

⚠️ **CRITICAL COLOR ISSUE #3** — Use Semantic Colors, NOT Direct Color Utilities:
- **WRONG:** Title `text-gray-900`, Subtitle `text-gray-600`
- **CORRECT:** Title `text-slate-900`, Subtitle `text-muted-foreground`
- **Impact:** Direct colors don't respect theme changes; breaks dark mode/theme consistency

| Mistake | Correct |
|---------|---------|
| `<div>` root wrapper (no classes) | `<div className="space-y-6">` |
| Header inside `<form>` | Header outside `<form>`, as a sibling |
| Fixed-size icon box (`h-12 w-12 flex items-center justify-center`) | Padding-based icon box (`p-2 rounded-lg`) |
| `gap-3` or `space-x-3` between icon and title | `gap-4` (matches Add VM reference) |
| `tracking-tight` on title | `text-slate-900` on title |
| **Subtitle margin `mt-1`** | **`mt-2` on subtitle (8px)** - CRITICAL |
| **Title color `text-gray-900`** | **`text-slate-900`** - CRITICAL (semantic) |
| **Subtitle color `text-gray-600`** | **`text-muted-foreground`** - CRITICAL (semantic) |
| Spinner-only loading state | Show header + spinner below (like the loaded state, but with a spinner in place of content) |

### 14.2 Section Panel Consistency

All gradient header sections within a single app **MUST** use identical structural properties:

```tsx
{/* Container */}
<div className="shadow-lg border-0 p-0 bg-white rounded-lg">

  {/* Header - ALWAYS these exact classes */}
  <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
    ...
  </div>

  {/* Content - ALWAYS p-6, never p-4 */}
  <div className="p-6 bg-gradient-to-b from-white to-gray-50">
    ...
  </div>
</div>
```

**Rules:**
- **CRITICAL:** Icon-to-title spacing is **always `gap-4`** — never use `space-x-3` or `gap-3` (causes visual misalignment across pages)
- Content padding is **always `p-6`** — never mix `p-4` and `p-6` within the same app
- Grid gap is **always `gap-4`** — never mix `gap-3` and `gap-4`
- Header layout uses `justify-between` when there are action buttons on the right; this is fine
- All sections within an app must have the same header height (same `py-2 px-4`, same `text-sm font-medium`)

### 14.3 Loading State Pattern

Loading states **MUST** preserve the page header so the page doesn't visually "jump" when data loads:

```tsx
if (isLoading) {
  return (
    <div className="space-y-6">
      {/* Same header as the loaded state */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Icon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Page Title</h1>
            <p className="text-muted-foreground mt-2">Description</p>
          </div>
        </div>
      </div>
      {/* Centered spinner */}
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  )
}
```

### 14.4 Reference Implementation

When in doubt, use the **Add VM** page as the canonical reference for page structure:

- **File:** `/frontend/src/components/features/nautobot/add-vm/add-vm-page.tsx`
- **Why:** Clean separation of header/form, correct spacing, consistent panel padding, proper loading state

---

**Need Implementation Help?**

This guide focuses on visual design. For complete feature implementation including:
- File organization and structure
- Custom hooks patterns
- API integration with `useApi`
- TypeScript type definitions
- State management

Refer to the comprehensive [STYLE_GUIDE.md](STYLE_GUIDE.md).
