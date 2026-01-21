# Cockpit-NG Application Style Guide

**Version:** 2.0  
**Last Updated:** 2026-01-21  
**Purpose:** Comprehensive guide for building consistent, professional UI components in Cockpit-NG.

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
10. [Implementation Checklist](#10-implementation-checklist)
11. [Common Mistakes to Avoid](#11-common-mistakes-to-avoid)
12. [Quick Reference: Common Code Patterns](#12-quick-reference-common-code-patterns)
13. [File Organization](#13-file-organization)
14. [API & Data Fetching](#14-api--data-fetching)
15. [Custom Hooks Patterns](#15-custom-hooks-patterns)
16. [TypeScript Types](#16-typescript-types)
17. [Dialogs & Modals](#17-dialogs--modals)
18. [Common Icons Reference](#18-common-icons-reference)
19. [State Management](#19-state-management)
20. [Shared Components](#20-shared-components)
21. [Testing Checklist](#21-testing-checklist)
22. [Complete Feature Template](#22-complete-feature-template)
23. [Resources](#23-resources)
24. [Version History](#24-version-history)

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

## 10. Implementation Checklist

### When Creating a New Page (Non-Tabbed)

- [ ] Create root container with `space-y-6`
- [ ] Add page header with colored icon box, title, and description
- [ ] Add optional quick action buttons in header (right side)
- [ ] Use gradient header sections for main content areas
- [ ] Add loading states for async operations
- [ ] Include empty states where appropriate
- [ ] Use semantic colors for status indicators
- [ ] Add proper ARIA labels and accessibility attributes
- [ ] Test responsive layout on mobile devices

### When Creating a New Page (Tabbed)

- [ ] Create root container with `space-y-6`
- [ ] Add page header with colored icon box, title, and description
- [ ] Set up Tabs component with appropriate TabsList grid
- [ ] Add `space-y-6` to each TabsContent
- [ ] Use gradient header sections within each tab
- [ ] Ensure logical flow between tabs (e.g., selection → configuration → execution)
- [ ] Add alerts in tabs to guide users through workflow
- [ ] Include loading and empty states in each tab
- [ ] Test tab navigation and state persistence

### When Creating a New Content Section

- [ ] Choose between gradient header section (prominent) or plain card (simple)
- [ ] Add appropriate icon to gradient header
- [ ] Use `p-6 bg-gradient-to-b from-white to-gray-50` for content area
- [ ] Maintain `space-y-4` or `space-y-6` between form elements
- [ ] Use semantic colors for alerts and status indicators
- [ ] Add helper text where needed (`text-xs text-gray-500`)

---

## 11. Common Mistakes to Avoid

### ❌ Don't

- Don't use `bg-blue-100` for headers (outdated pattern)
- Don't mix gradient sections with plain cards in the same feature
- Don't use inline styles or arbitrary colors
- Don't forget `space-y-6` wrapper around content
- Don't use `pt-6` when parent already has padding
- Don't use different header styles within the same feature
- Don't create custom loading spinners (use standard pattern)
- Don't use `alert()` or `confirm()` (use Dialog/AlertDialog)
- Don't build UI from scratch when shadcn components exist

### ✅ Do

- Use gradient header pattern for main feature sections
- Maintain consistent spacing with `space-y-6` and `space-y-4`
- Use semantic color classes (success, error, info, warning)
- Use shadcn UI components for all UI primitives
- Add loading and empty states
- Use Lucide React icons consistently
- Follow the typography scale
- Test on mobile devices
- Add proper accessibility attributes

---

## 12. Quick Reference: Common Code Patterns

### Page Template (No Tabs)

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
        <div className="flex items-center space-x-3">
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

### Page Template (With Tabs)

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
        <div className="flex items-center space-x-3">
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

## 13. File Organization

### 13.1 Feature Directory Structure

Follow feature-based organization:

```
frontend/src/components/features/[domain]/[feature]/
├── [feature]-page.tsx          # Main page component
├── index.ts                    # Public exports (optional)
├── components/                  # Feature-specific components
│   ├── [component-name].tsx
│   └── ...
├── tabs/                       # Tab components (if tabbed interface)
│   ├── [tab-name]-tab.tsx
│   └── ...
├── dialogs/                    # Modal dialogs
│   ├── [dialog-name]-dialog.tsx
│   └── ...
├── hooks/                      # Custom hooks
│   ├── use-[feature-name].ts
│   └── queries/               # TanStack Query hooks (if used)
│       ├── use-[resource]-query.ts
│       └── index.ts
├── types/                      # TypeScript types
│   └── index.ts
├── ui/                         # Feature-specific UI components
│   └── [ui-component].tsx
└── utils/                      # Utility functions
    └── [util-name].ts
```

### 13.2 App Directory Structure

Route pages are thin wrappers that import feature components:

```
frontend/src/app/(dashboard)/[domain]/[feature]/
└── page.tsx                    # Imports and renders feature page component
```

**Page.tsx Pattern:**

```tsx
import FeaturePage from '@/components/features/[domain]/[feature]/[feature]-page'

export default function Page() {
  return <FeaturePage />
}
```

### 13.3 Shared Resources Location

| Resource Type | Location |
|--------------|----------|
| UI Components | `/frontend/src/components/ui/` |
| Shared Feature Components | `/frontend/src/components/shared/` |
| Global Hooks | `/frontend/src/hooks/` |
| Global Types | `/frontend/src/types/` |
| Feature Types | `/frontend/src/types/features/[domain]/` |
| Utility Functions | `/frontend/src/utils/` or `/frontend/src/lib/` |
| Auth Store | `/frontend/src/lib/auth-store.ts` |

---

## 14. API & Data Fetching

### 14.1 The useApi Hook

Use the `useApi` hook for all API calls. It handles authentication, error responses, and redirects automatically.

```tsx
import { useApi } from '@/hooks/use-api'

function MyComponent() {
  const { apiCall } = useApi()
  
  const fetchData = async () => {
    try {
      const response = await apiCall<MyResponseType>('endpoint/path')
      // Handle response
    } catch (error) {
      // Handle error
    }
  }
}
```

**API Call Methods:**

```tsx
// GET request (default)
const data = await apiCall<ResponseType>('devices')

// POST request
const result = await apiCall<ResponseType>('devices', {
  method: 'POST',
  body: { name: 'Device1', type: 'router' }
})

// PUT request
await apiCall('devices/123', {
  method: 'PUT',
  body: updatedData
})

// DELETE request
await apiCall('devices/123', { method: 'DELETE' })

// With query parameters
const params = new URLSearchParams({ limit: '50', offset: '0' })
const data = await apiCall<ResponseType>(`devices?${params}`)
```

### 14.2 Data Fetching in Components

**Loading Pattern:**

```tsx
const [data, setData] = useState<DataType[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

const loadData = useCallback(async () => {
  try {
    setLoading(true)
    setError(null)
    const response = await apiCall<{ items: DataType[] }>('endpoint')
    setData(response.items || [])
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load data')
  } finally {
    setLoading(false)
  }
}, [apiCall])

useEffect(() => {
  void loadData()
}, [loadData])
```

### 14.3 TanStack Query Patterns (Optional)

For complex data requirements, use TanStack Query:

```tsx
// hooks/queries/use-devices-query.ts
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'

export function useDevicesQuery() {
  const { apiCall } = useApi()
  
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => apiCall<Device[]>('devices'),
  })
}
```

**Usage:**

```tsx
const { data, isLoading, error, refetch } = useDevicesQuery()
```

### 14.4 API Endpoint Conventions

All API endpoints go through the Next.js proxy at `/api/proxy/`:

| Backend Endpoint | Frontend API Call |
|-----------------|-------------------|
| `GET /devices` | `apiCall('devices')` |
| `POST /jobs/run` | `apiCall('jobs/run', { method: 'POST', body })` |
| `GET /nautobot/devices?limit=50` | `apiCall('nautobot/devices?limit=50')` |

---

## 15. Custom Hooks Patterns

### 15.1 Hook Organization

Feature-specific hooks go in the feature's `hooks/` directory:

```
hooks/
├── use-device-loader.ts      # Data loading
├── use-device-filters.ts     # Filter state management
├── use-device-selection.ts   # Selection state
├── use-device-operations.ts  # CRUD operations
└── use-status-messages.ts    # Status/notification state
```

### 15.2 Hook Template

```tsx
// hooks/use-feature-state.ts
import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'

interface UseFeatureStateOptions {
  onSuccess?: (message: string) => void
  onError?: (error: string) => void
}

export function useFeatureState(options: UseFeatureStateOptions = {}) {
  const { apiCall } = useApi()
  const { onSuccess, onError } = options
  
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DataType | null>(null)
  
  const performAction = useCallback(async (params: ActionParams) => {
    try {
      setLoading(true)
      const result = await apiCall<ResultType>('endpoint', {
        method: 'POST',
        body: params
      })
      setData(result)
      onSuccess?.('Action completed successfully')
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed'
      onError?.(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [apiCall, onSuccess, onError])
  
  return {
    data,
    loading,
    performAction,
  }
}
```

### 15.3 Status Messages Hook

```tsx
// hooks/use-status-messages.ts
import { useState, useCallback } from 'react'

interface StatusMessage {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export function useStatusMessages() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  
  const showMessage = useCallback((message: string, type: StatusMessage['type'] = 'info') => {
    setStatusMessage({ type, message })
  }, [])
  
  const clearMessage = useCallback(() => {
    setStatusMessage(null)
  }, [])
  
  return { statusMessage, showMessage, clearMessage }
}
```

---

## 16. TypeScript Types

### 16.1 Type Location

- **Feature-specific types**: `/frontend/src/components/features/[domain]/[feature]/types/index.ts`
- **Shared domain types**: `/frontend/src/types/features/[domain]/index.ts`
- **Global types**: `/frontend/src/types/`

### 16.2 Type Patterns

**API Response Types:**

```tsx
// types/index.ts
export interface Device {
  id: string
  name: string
  status: DeviceStatus
  primary_ip4?: {
    address: string
  } | null
  device_type?: {
    display: string
  } | null
  location?: {
    display: string
  } | null
}

export type DeviceStatus = 'active' | 'planned' | 'staged' | 'failed' | 'offline'

export interface DevicesResponse {
  devices: Device[]
  count: number
  has_more: boolean
}
```

**Component Props Types:**

```tsx
interface DeviceTableProps {
  devices: Device[]
  loading: boolean
  selectedIds: string[]
  onSelect: (id: string) => void
  onSelectAll: () => void
}
```

**Hook Return Types:**

```tsx
interface UseDeviceLoaderReturn {
  devices: Device[]
  loading: boolean
  error: string | null
  reloadDevices: () => Promise<void>
}
```

---

## 17. Dialogs & Modals

### 17.1 Dialog Structure

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

### 17.2 Confirmation Dialog

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

### 17.3 Error Dialog

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

### 17.4 Dialog Size Classes

| Size | Class | Use Case |
|------|-------|----------|
| Small | `max-w-sm` | Simple confirmations |
| Medium | `max-w-md` | Standard dialogs |
| Large | `max-w-lg` | Forms with multiple fields |
| Extra Large | `max-w-2xl` | Complex content, tables |
| Full | `max-w-4xl` | Large data displays |

---

## 18. Common Icons Reference

Use Lucide React icons consistently:

| Icon | Import | Use Case |
|------|--------|----------|
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

## 19. State Management

### 19.1 Local Component State

Use `useState` for UI state that doesn't need to persist:

```tsx
const [isOpen, setIsOpen] = useState(false)
const [selectedId, setSelectedId] = useState<string | null>(null)
```

### 19.2 Feature-Level Hooks

Extract complex state into custom hooks:

```tsx
// Instead of many useState calls in component:
const deviceSelection = useDeviceSelection()
const deviceFilters = useDeviceFilters(devices)
const statusMessages = useStatusMessages()
```

### 19.3 Auth Store (Zustand)

Use the auth store for authentication state:

```tsx
import { useAuthStore } from '@/lib/auth-store'

function MyComponent() {
  const { token, isAuthenticated, logout } = useAuthStore()
  
  // Wait for auth before loading data
  useEffect(() => {
    if (isAuthenticated && token) {
      void loadData()
    }
  }, [isAuthenticated, token])
}
```

### 19.4 URL State

Use URL parameters for shareable state (filters, pagination):

```tsx
import { useSearchParams } from 'next/navigation'

function MyComponent() {
  const searchParams = useSearchParams()
  const page = searchParams.get('page') || '1'
}
```

---

## 20. Shared Components

### 20.1 Device Selector

Use the shared device selector for device selection:

```tsx
import { DeviceSelector, type DeviceInfo } from '@/components/shared/device-selector'

<DeviceSelector
  selectedDeviceIds={selectedIds}
  onDevicesSelected={handleDevicesSelected}
  onSelectionChange={handleSelectionChange}
/>
```

### 20.2 When to Create Shared Components

Create shared components when:
- Used by 3+ features
- Implements complex, reusable logic
- Provides consistent UX across the application

Location: `/frontend/src/components/shared/`

---

## 21. Testing Checklist

Before considering a page complete:

- [ ] **Visual**: Matches reference applications in layout and spacing
- [ ] **Colors**: Uses semantic colors consistently
- [ ] **Typography**: Follows typography scale
- [ ] **Spacing**: Uses standard spacing utilities
- [ ] **Loading**: Includes loading states for all async operations
- [ ] **Empty States**: Handles no data scenarios gracefully
- [ ] **Errors**: Displays errors with proper styling and recovery options
- [ ] **Mobile**: Responsive on mobile devices
- [ ] **Accessibility**: ARIA labels and keyboard navigation work
- [ ] **Icons**: Lucide React icons used consistently
- [ ] **API Calls**: Uses `useApi` hook with proper error handling
- [ ] **TypeScript**: All types defined and exported properly
- [ ] **Hooks**: Complex logic extracted into custom hooks
- [ ] **File Structure**: Follows feature-based organization

---

## 22. Complete Feature Template

### 22.1 Step-by-Step Feature Creation

**Step 1: Create Directory Structure**

```bash
mkdir -p frontend/src/components/features/[domain]/[feature]/{components,hooks,dialogs,types}
```

**Step 2: Define Types** (`types/index.ts`)

```tsx
export interface MyItem {
  id: string
  name: string
  status: 'active' | 'inactive'
  createdAt: string
}

export interface MyItemsResponse {
  items: MyItem[]
  count: number
}
```

**Step 3: Create Custom Hook** (`hooks/use-my-feature.ts`)

```tsx
import { useState, useCallback, useEffect } from 'react'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import type { MyItem, MyItemsResponse } from '../types'

export function useMyFeature() {
  const { apiCall } = useApi()
  const { isAuthenticated, token } = useAuthStore()
  
  const [items, setItems] = useState<MyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiCall<MyItemsResponse>('my-endpoint')
      setItems(response.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [apiCall])
  
  useEffect(() => {
    if (isAuthenticated && token) {
      void loadItems()
    }
  }, [isAuthenticated, token, loadItems])
  
  return { items, loading, error, reload: loadItems }
}
```

**Step 4: Create Main Page** (`[feature]-page.tsx`)

```tsx
'use client'

import { useState } from 'react'
import { Settings, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

import { useMyFeature } from './hooks/use-my-feature'
import { ItemTable } from './components/item-table'
import { AddItemDialog } from './dialogs/add-item-dialog'

export default function MyFeaturePage() {
  const { items, loading, error, reload } = useMyFeature()
  const [showAddDialog, setShowAddDialog] = useState(false)
  
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Settings className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Feature</h1>
            <p className="text-gray-600 mt-1">Manage your items efficiently</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={reload} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            Add Item
          </Button>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Main Content */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-purple-400/80 to-purple-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">Items</span>
          </div>
          <div className="text-xs text-purple-100">
            {items.length} items total
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              <span className="ml-3 text-gray-600">Loading items...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No items found</p>
              <p className="text-sm mt-1">Click "Add Item" to create your first item</p>
            </div>
          ) : (
            <ItemTable items={items} onReload={reload} />
          )}
        </div>
      </div>
      
      {/* Dialogs */}
      <AddItemDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onSuccess={reload}
      />
    </div>
  )
}
```

**Step 5: Create Route Page** (`app/(dashboard)/[domain]/[feature]/page.tsx`)

```tsx
import MyFeaturePage from '@/components/features/[domain]/[feature]/[feature]-page'

export default function Page() {
  return <MyFeaturePage />
}
```

---

## 23. Resources

**Component Libraries:**
- Shadcn UI: https://ui.shadcn.com
- Lucide Icons: https://lucide.dev
- TanStack Query: https://tanstack.com/query

**Reference Implementations:**
- CheckMK Sync Devices: `/frontend/src/components/features/checkmk/sync-devices/`
- Netmiko Automation: `/frontend/src/components/features/network/automation/netmiko/`

**Project Documentation:**
- Architecture Overview: `/CLAUDE.md`
- Installation Guide: `/INSTALL.md`
- Previous Style Reference: `/doc/STYLES.md`

**Instructions Files:**
- Copilot Instructions: `/.github/instructions/copilot-instructions.md`
- React Guidelines: `/.github/instructions/react.instructions.md`
- TypeScript Guidelines: `/.github/instructions/typescript.instructions.md`
- Tailwind Guidelines: `/.github/instructions/tailwind.instructions.md`

---

## 24. Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-01-21 | Complete rewrite with comprehensive patterns |
| 1.0 | - | Initial style guide (see `/doc/STYLES.md`) |

---

**Questions or Need Help?**

1. Check existing implementations in the reference features
2. Review the instruction files in `/.github/instructions/`
3. Consult `/doc/STYLES.md` for additional legacy patterns
