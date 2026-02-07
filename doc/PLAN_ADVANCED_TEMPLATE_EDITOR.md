# Advanced Template Editor - Implementation Plan

## Context

The current template editing experience in Cockpit-NG uses a basic form with a plain `<textarea>` for content editing (`/settings/templates`). For Jinja2 templates that reference Nautobot device data, SNMP mappings, and other variables, this is insufficient. Users need:

- A proper code editor with syntax highlighting (Monaco)
- Visibility into which variables are available for rendering, based on template category
- Category-specific context (e.g., agent templates get `devices`, `device_details`, `snmp_mapping`, `path`)
- Ability to preview rendered output before saving
- Ability to add custom variables beyond the category defaults

This plan creates a **new dedicated page** at `/templates/editor` with a split-panel layout, leaving the existing simple template form unchanged.

---

## Layout Overview

```
+------------------------------------------------------------------------+
|  GENERAL PANEL (top)                                                    |
|  [Name] [Type] [Category] [Description] [Global checkbox]              |
|  --- Agent-only options (shown when category=agent) ---                 |
|  [Inventory selector] [SNMP Mapping checkbox] [Path input]             |
+------------------------------------------------------------------------+
|  MAIN AREA                                                              |
|  +-------------------------+  +--------------------------------------+  |
|  | VARIABLES (left top)    |  |                                      |  |
|  | - devices               |  |  MONACO CODE EDITOR (right)          |  |
|  | - device_details        |  |                                      |  |
|  | - snmp_mapping          |  |  {% for device in devices %}         |  |
|  | - path                  |  |    {{ device.name }}                 |  |
|  | - [+ Add Variable]     |  |  {% endfor %}                        |  |
|  +-------------------------+  |                                      |  |
|  | VARIABLE VALUES (left   |  |                                      |  |
|  | bottom)                 |  |                                      |  |
|  | devices: (auto-filled)  |  |                                      |  |
|  | custom_var: [editable]  |  |                                      |  |
|  +-------------------------+  +--------------------------------------+  |
+------------------------------------------------------------------------+
|  [Show Rendered Template]                              [Save Template]  |
+------------------------------------------------------------------------+
```

---

## File Structure

```
frontend/src/components/features/templates/editor/
  ├── index.ts                              # Barrel export
  ├── components/
  │   ├── template-editor-page.tsx          # Main page component (orchestrator)
  │   ├── general-panel.tsx                 # Top: name, type, category, desc, scope
  │   ├── agent-options-panel.tsx           # Agent-specific: inventory, SNMP, path
  │   ├── variables-panel.tsx               # Left top: variable names with add/remove
  │   ├── variable-values-panel.tsx         # Left bottom: variable values (editable)
  │   ├── code-editor-panel.tsx             # Right: Monaco editor wrapper
  │   └── rendered-output-dialog.tsx        # Dialog showing rendered template
  ├── hooks/
  │   ├── use-template-editor.ts            # Main form state (react-hook-form + zod)
  │   ├── use-template-variables.ts         # Variable management per category
  │   └── use-template-render.ts            # Render mutation (calls backend)
  ├── types/
  │   └── index.ts                          # TypeScript interfaces
  └── utils/
      └── category-variables.ts             # Default variables per category

frontend/src/app/(dashboard)/templates/editor/page.tsx   # Route page
```

---

## Step-by-Step Implementation

### Step 1: Install Monaco Editor

```bash
cd frontend && npm install @monaco-editor/react
```

This installs `@monaco-editor/react` which wraps Microsoft's Monaco editor for React. It lazy-loads the editor from a CDN by default (no large bundle).

### Step 2: Create Types (`types/index.ts`)

```typescript
export interface TemplateVariable {
  id: string
  name: string
  value: string
  isDefault: boolean    // true = comes from category, cannot remove name
  isAutoFilled: boolean // true = value populated by backend (read-only display)
}

export interface EditorFormData {
  name: string
  template_type: 'jinja2' | 'text' | 'textfsm'
  category: string
  description: string
  scope: 'global' | 'private'
  content: string
  // Agent-specific
  inventoryId: number | null
  passSnmpMapping: boolean
  path: string
}

export interface RenderResult {
  success: boolean
  renderedContent: string
  error?: string
  warnings?: string[]
}
```

### Step 3: Create Category Variables Map (`utils/category-variables.ts`)

Define what default variables each category provides. These populate the variables panel automatically when the user selects a category.

```typescript
interface CategoryConfig {
  defaults: string[]
  descriptions: Record<string, string>
}

const CATEGORY_VARIABLES: Record<string, CategoryConfig> = {
  agent: {
    defaults: ['devices', 'device_details', 'snmp_mapping', 'path'],
    descriptions: {
      devices: 'List of devices from inventory',
      device_details: 'Detailed device data from Nautobot (per device)',
      snmp_mapping: 'SNMP credential mapping (if enabled)',
      path: 'Deployment path',
    }
  },
  netmiko: {
    defaults: ['device', 'hostname', 'ip_address', 'platform'],
    descriptions: {
      device: 'Target device object from Nautobot',
      hostname: 'Device hostname',
      ip_address: 'Device management IP',
      platform: 'Device platform/OS',
    }
  },
  ansible: {
    defaults: ['hosts', 'groups', 'inventory_name'],
    descriptions: {
      hosts: 'List of target hosts',
      groups: 'Host group assignments',
      inventory_name: 'Name of the inventory',
    }
  },
  onboarding: {
    defaults: ['device', 'device_type', 'platform', 'location', 'role'],
    descriptions: {
      device: 'Device being onboarded',
      device_type: 'Hardware model',
      platform: 'Software platform',
      location: 'Physical location',
      role: 'Device role',
    }
  },
  parser: {
    defaults: ['input', 'template_name'],
    descriptions: {
      input: 'Raw command output to parse',
      template_name: 'Name of the TextFSM template',
    }
  },
  __none__: {
    defaults: [],
    descriptions: {}
  }
}
```

Export a helper `getDefaultVariables(category)` that returns `TemplateVariable[]`.

### Step 4: Create Hooks

#### `use-template-variables.ts`

Manages the dynamic variables list. Reacts to category changes by resetting defaults.

- **State**: `variables: TemplateVariable[]`
- **On category change**: Reset to category defaults + keep user-added variables
- **Methods**: `addVariable()`, `removeVariable(id)`, `updateVariable(id, field, value)`
- **Constraint**: Default variables can't be removed (but user can add more)
- Follow the existing pattern from `agents/deploy/hooks/use-variable-manager.ts`
- Return value must be memoized with `useMemo`

#### `use-template-editor.ts`

Main form hook using `react-hook-form` + `zod`.

- Wraps `useForm<EditorFormData>` with zodResolver
- `useWatch` for `category` to trigger variable updates
- Handles loading existing template from URL param `?id=`
- Uses `useTemplateContent(id)` from existing hooks for edit mode

#### `use-template-render.ts`

Handles the "Show Rendered Template" button.

- **Agent category**: POST to `/api/proxy/agents/deploy/dry-run` (existing endpoint)
  - Requires: `templateId` (or raw content), `deviceIds`, `variables`, `passSnmpMapping`, `path`
  - **Note**: For new unsaved templates, we need the template content rendered server-side. The existing dry-run endpoint works by template ID. We should either: save a draft first, or extend the endpoint to accept raw content. **Decision: Use the existing `/api/templates/render` endpoint** which already accepts raw `template_content`.
- **Other categories**: POST to `/api/proxy/templates/render` (existing endpoint)
  - Accepts: `template_content`, `category`, `device_id` (optional), `user_variables`
- Returns `RenderResult` to display in dialog

### Step 5: Create Components

#### `general-panel.tsx`

Top panel with template metadata fields.

- **Layout**: Grid with responsive columns (matching existing `template-form.tsx` pattern)
- **Fields**: Name, Type (select), Category (select), Description, Scope checkbox
- Use `FormField` from shadcn forms
- **Style**: Card with gradient header (blue) per style guide
- Uses `CANONICAL_CATEGORIES` from existing `utils/constants.ts`
- When category changes, emit event to update variables panel

#### `agent-options-panel.tsx`

Conditional panel shown only when `category === 'agent'`.

- **Inventory selector**: `<Select>` populated by `useSavedInventoriesQuery()` (existing hook at `/frontend/src/hooks/queries/use-saved-inventories-queries.ts`)
- **SNMP Mapping checkbox**: Default `true`, controls whether `snmp_mapping` variable is included
- **Path input**: Text field for deployment path
- **Style**: Card with purple background tint (matching existing agent styling in `template-form.tsx`)

#### `variables-panel.tsx`

Left top panel showing variable names.

- Displays list of variable names as tags/badges
- Default variables shown with lock icon (non-removable)
- User-added variables shown with X button (removable)
- "+ Add Variable" button at bottom
- When a variable is clicked, scroll to its value in the values panel below
- **Style**: Compact list with `Badge` components from shadcn

#### `variable-values-panel.tsx`

Left bottom panel showing variable values.

- For each variable: label + value display
- Default/auto-filled variables: read-only display with gray background, description tooltip
- User-added variables: editable `<Input>` fields for name and value
- **Layout**: Vertical list with `space-y-2`

#### `code-editor-panel.tsx`

Right panel with Monaco editor.

- Wraps `@monaco-editor/react` `<Editor>` component
- **Language**: Set based on `template_type` (jinja2 → use "html" or "twig" mode, text → plaintext, textfsm → plaintext)
- **Theme**: Light theme matching app design
- **Options**: minimap disabled (save space), word wrap on, line numbers on, font size 14
- **Height**: Fill available vertical space using flexbox
- `onChange` updates form content value

#### `rendered-output-dialog.tsx`

Dialog showing rendered template output.

- Uses shadcn `Dialog` component
- **Header**: Gradient header with "Rendered Template" title
- **Body**: Monaco editor in read-only mode (reuse same component, or use `<pre>` with monospace)
- **Footer**: Close button + Copy to Clipboard button
- Shows error state if rendering failed (red alert with error message)
- Shows warnings if any (amber alert)

#### `template-editor-page.tsx`

Main orchestrator component.

- Reads URL search params for `?id=` (edit mode) or no param (create mode)
- Initializes all hooks
- **Layout**:
  - Page header with icon box (purple for templates) + title + description
  - General panel
  - Agent options panel (conditional)
  - Main split area using CSS grid: `grid-cols-[350px_1fr]` (left panel fixed width, editor fills rest)
  - Left panel: `flex flex-col` with variables panel (top, flex-shrink) and values panel (bottom, flex-grow)
  - Bottom button bar
- **Buttons**:
  - "Show Rendered Template" (outline, blue) - calls render hook, opens dialog
  - "Save Template" (solid, green) - calls create/update mutation

### Step 6: Create Route Page

`/frontend/src/app/(dashboard)/templates/editor/page.tsx`:

```typescript
import { TemplateEditorPage } from '@/components/features/templates/editor'

export default function TemplateEditorRoute() {
  return <TemplateEditorPage />
}
```

### Step 7: Add Navigation Entry

In `/frontend/src/components/layout/app-sidebar.tsx`, add a "Template Editor" entry:

- Under **Network > Automation** section, add entry for "Template Editor" linking to `/templates/editor`
- Icon: `FileCode` from lucide-react
- Or alternatively, add an "Advanced Edit" button in the existing templates list page that navigates to `/templates/editor?id={templateId}`

### Step 8: Add Query Keys (if needed)

The existing `queryKeys.templates` in `/frontend/src/lib/query-keys.ts` already has `list`, `detail`, `content`, `categories`. Add a `render` key if we want to cache render results:

```typescript
templates: {
  // ...existing keys...
  render: (templateId: number | 'new') =>
    [...queryKeys.templates.all, 'render', templateId] as const,
}
```

---

## Existing Code to Reuse

| Need | Existing Code | Location |
|------|--------------|----------|
| Template types & interfaces | `Template`, `TemplateFormData` | `/frontend/src/components/features/settings/templates/types/index.ts` |
| Category constants | `CANONICAL_CATEGORIES` | `/frontend/src/components/features/settings/templates/utils/constants.ts` |
| Template query hooks | `useTemplateContent` | `/frontend/src/components/features/settings/templates/hooks/use-template-queries.ts` |
| Template mutations | `useTemplateMutations` | `/frontend/src/components/features/settings/templates/hooks/use-template-mutations.ts` |
| Saved inventories query | `useSavedInventoriesQuery` | `/frontend/src/hooks/queries/use-saved-inventories-queries.ts` |
| Variable manager pattern | `useVariableManager` | `/frontend/src/components/features/agents/deploy/hooks/use-variable-manager.ts` |
| API calling | `useApi` | `/frontend/src/hooks/use-api.ts` |
| Query keys | `queryKeys.templates.*`, `queryKeys.inventory.*` | `/frontend/src/lib/query-keys.ts` |
| Backend render endpoint | `POST /api/templates/render` | `/backend/routers/settings/templates.py` |
| Backend agent dry-run | `POST /api/agents/deploy/dry-run` | `/backend/routers/agents/deploy.py` |
| Toast notifications | `useToast` | `/frontend/src/hooks/use-toast.ts` |
| Form components | `Form`, `FormField`, etc. | `/frontend/src/components/ui/form.tsx` |

---

## Style Guide Compliance

- **Page header**: Purple icon box (`bg-purple-100`, `FileCode` icon `text-purple-600`), `text-3xl font-bold` title
- **General panel**: Card with gradient header `bg-gradient-to-r from-blue-400/80 to-blue-500/80`
- **Agent options**: Card with `bg-purple-50 border-purple-200` (existing pattern)
- **Variables panel**: Plain card, `shadow-lg border-0` container
- **Code editor**: Card with minimal border, full height
- **Buttons**: "Show Rendered Template" = `variant="outline"` blue; "Save Template" = `bg-green-600`
- **Spacing**: `space-y-6` between sections, `space-y-4` within forms, `gap-2` for inline items
- **Dialog**: Gradient header, `max-w-4xl` for rendered output

---

## Backend

**No new backend endpoints needed.** The existing endpoints cover all requirements:

1. **Template CRUD**: `GET/POST/PUT/DELETE /api/templates` + `/api/templates/{id}`
2. **Template content**: `GET /api/templates/{id}/content`
3. **Template rendering**: `POST /api/templates/render` (accepts raw content + variables)
4. **Agent dry-run**: `POST /api/agents/deploy/dry-run` (renders with Nautobot context)
5. **Inventory list**: `GET /api/inventory` (for inventory selector)
6. **SNMP mappings**: `GET /api/settings/compliance/snmp-mappings`

---

## Verification

1. **Install & Build**: Run `npm install @monaco-editor/react` and `npm run build` to verify no type errors
2. **Route accessible**: Navigate to `http://localhost:3000/templates/editor` - page loads
3. **General panel**: Fill in name, select category, verify agent options appear/hide based on category
4. **Monaco editor**: Type Jinja2 content, verify syntax highlighting works
5. **Variables update**: Change category, verify default variables update automatically
6. **Add custom variable**: Click "+ Add Variable", fill in name/value, verify it persists
7. **Render template**: Click "Show Rendered Template", verify dialog opens with rendered output (requires backend running)
8. **Save template**: Click "Save Template", verify template appears in `/settings/templates` list
9. **Edit mode**: Navigate to `/templates/editor?id={id}`, verify template data loads into form
10. **Responsive**: Resize browser, verify layout adapts (editor stacks below variables on small screens)
