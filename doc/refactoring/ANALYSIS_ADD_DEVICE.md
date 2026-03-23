# Add-Device Feature — Post-Refactoring Code Review & Fix Plan

**Date:** March 2026
**Status:** 🔍 ANALYSIS — Awaiting execution
**Scope:** `src/components/features/nautobot/add-device/`
**Trigger:** Comprehensive code review after large feature additions (CSV import wizard, interface table, bulk editing)

---

## Executive Summary

The add-device feature was previously refactored from 2,046 lines to a feature-based structure (see `REFACTORING_NAUTOBOT_ADD_DEVICE_PAGE.md`). Since then significant new functionality has been added. This post-refactoring review identified **3 critical bugs**, **4 dead files**, **2 file-size violations**, and several medium-priority issues.

All issues fall into 4 phases:

| Phase | Description | Priority | Effort |
|---|---|---|---|
| 1 | Delete dead code | CRITICAL | 30 min |
| 2 | Fix bugs (Tailwind, console logs) | CRITICAL | 1–2 hours |
| 3 | Split oversized hooks | HIGH | 1 day |
| 4 | Medium-quality improvements | MEDIUM | 1 day |

---

## Phase 1 — Delete Dead Code (30 min)

These files exist in the add-device folder but are **not used** by `add-device-page.tsx`. They were superseded by newer implementations but never removed.

### 1.1 Backup file committed to repo

**File:** `src/components/features/nautobot/add-device/components/interface-list.tsx.backup-20260117-124817`

**Action:** Delete immediately.

```bash
rm "frontend/src/components/features/nautobot/add-device/components/interface-list.tsx.backup-20260117-124817"
```

**Verification:** `git status` should not list it.

---

### 1.2 `use-csv-upload.ts` — superseded by `use-csv-import.ts`

**File:** `src/components/features/nautobot/add-device/hooks/use-csv-upload.ts` (570 lines)

**Evidence of dead code:**
- Not imported in `add-device-page.tsx`
- The `onboard` feature has its **own copy** at `onboard/hooks/use-csv-upload.ts`
- The test file mocks it, but that mock is also dead (see 1.3)
- Contains 35+ debug `console.log` lines that were never cleaned up

**Action:** Delete the file and remove its export from `hooks/index.ts`.

```typescript
// hooks/index.ts — REMOVE this line:
export { useCSVUpload } from './use-csv-upload'
```

**Update test mock in** `add-device-page.test.tsx`:
- Remove the `useCSVUpload` mock block (lines ~14–20)

---

### 1.3 `csv-upload-modal.tsx` — superseded by `csv-import-wizard.tsx`

**File:** `src/components/features/nautobot/add-device/components/csv-upload-modal.tsx`

**Evidence of dead code:**
- Not imported in `add-device-page.tsx` (uses `CsvImportWizard` instead)
- Only referenced in the test mock (which will be cleaned up in 1.2)

**Action:** Delete the file and remove its export from `components/index.ts`.

```typescript
// components/index.ts — REMOVE this line:
export { CsvUploadModal } from './csv-upload-modal'
```

**Update test mock in** `add-device-page.test.tsx`:
- Remove the `vi.mock('./components/csv-upload-modal', ...)` block

---

### 1.4 `bulk-update-modal.tsx` — wrong feature folder

**File:** `src/components/features/nautobot/add-device/components/bulk-update-modal.tsx`

**Evidence of dead code:**
- Not imported in `add-device-page.tsx`
- The bulk-edit feature has its own implementation at `tools/bulk-edit/dialogs/csv-upload-dialog.tsx`

**Action:** Delete the file and remove its export from `components/index.ts`.

```typescript
// components/index.ts — REMOVE this line:
export { BulkUpdateModal } from './bulk-update-modal'
```

---

## Phase 2 — Fix Critical Bugs (1–2 hours)

### 2.1 Broken Tailwind dynamic class in `status-alert.tsx`

**File:** `src/components/features/nautobot/add-device/components/status-alert.tsx`, line 14

**Problem:** Tailwind CSS purges dynamically constructed class strings. The class `` `border-${x}-500` `` will never exist in the production bundle — no border will render.

```tsx
// ❌ BROKEN — Tailwind cannot detect this class at build time
<Alert className={`border-${statusMessage.type === 'success' ? 'green' : 'blue'}-500`}>
```

**Fix:**

```tsx
// ✅ CORRECT — both classes are statically detectable
<Alert className={statusMessage.type === 'success' ? 'border-green-500' : 'border-blue-500'}>
```

**Verification:** After fix, visually confirm the success/info borders appear correctly in the UI.

---

### 2.2 Debug `console.log` block in `use-csv-upload.ts`

**File:** `src/components/features/nautobot/add-device/hooks/use-csv-upload.ts`, lines 86–120

**Problem:** A block of `=== CSV PARSING DEBUG ===` console output was left in production code. This is resolved if Phase 1 deletes the file, but must be fixed first if the file is kept for any reason.

**Fix (only needed if file is kept):** Remove lines 86–120 entirely (the labeled debug block).

---

### 2.3 `console.error` wall in `add-device-page.tsx` `onInvalid` callback

**File:** `src/components/features/nautobot/add-device/add-device-page.tsx`, lines 273–372

**Problem:** The `onInvalid` form submission handler contains ~100 lines of `console.error` debug output parsing interface validation errors. This was development scaffolding that was never removed.

**Fix:** Replace the entire debug block with a minimal handler that collects errors into a user-visible structure:

```typescript
const onInvalid = useCallback((validationErrors: FieldErrors<DeviceFormValues>) => {
  const errorMessages: string[] = []

  if (validationErrors.name) errorMessages.push(`Device name: ${validationErrors.name.message}`)
  if (validationErrors.deviceType) errorMessages.push(`Device type: ${validationErrors.deviceType.message}`)

  const interfaceErrors = validationErrors.interfaces
  if (Array.isArray(interfaceErrors)) {
    interfaceErrors.forEach((ifaceError, index) => {
      if (!ifaceError) return
      Object.entries(ifaceError).forEach(([field, err]) => {
        if (err && 'message' in err) {
          errorMessages.push(`Interface ${index + 1} / ${field}: ${err.message}`)
        }
      })
    })
  }

  setValidationErrorMessages(errorMessages)
  setShowValidationErrors(true)
}, [])
```

This removes ~90 lines from the page, bringing it from 659 to ~570 lines.

---

## Phase 3 — Split Oversized Hooks (1 day)

### 3.1 Split `use-csv-import.ts` (770 lines → three focused hooks)

**File:** `src/components/features/nautobot/add-device/hooks/use-csv-import.ts`

**Problem:** This hook manages 4 distinct responsibilities in 770 lines, well above the 400-line target.

**Target structure:**

```
hooks/
  use-csv-parser.ts          # NEW — file reading, header detection (≈ 120 lines)
  use-csv-column-mapping.ts  # NEW — column mapping state & auto-detection (≈ 150 lines)
  use-csv-import.ts          # KEEP — orchestrator, coordinates other hooks (≈ 250 lines)
```

#### `use-csv-parser.ts` — extract from lines 128–225

Responsibility: FileReader management, BOM stripping, header extraction.

```typescript
export interface CsvParserState {
  csvFile: File | null
  headers: string[]
  csvContent: string
  isParsing: boolean
  parseError: string
  parseResult: CSVParseResult | null
}

export function useCsvParser(delimiter: string) {
  // useState for: csvFile, headers, csvContent, isParsing, parseError, parseResult
  // handleFileSelect: FileReader, BOM stripping, header normalization
  // Returns stable state + handleFileSelect callback
}
```

#### `use-csv-column-mapping.ts` — extract from lines 90–127

Responsibility: Column mapping state, auto-detection logic, mandatory field tracking.

```typescript
export function useCsvColumnMapping(headers: string[], nautobotFields: string[]) {
  // useState for: columnMapping
  // useMemo: unmappedMandatoryFields, unmappedMandatoryInterfaceFields
  // Auto-mapping logic (DEFAULT_COLUMN_MAPPINGS, direct nautobotFields match)
  // Returns: columnMapping, setColumnMapping, unmappedMandatoryFields, unmappedMandatoryInterfaceFields
}
```

#### `use-csv-import.ts` — becomes the orchestrator

```typescript
export function useCsvImport(props: UseCsvImportProps) {
  const parser = useCsvParser(delimiter)
  const mapping = useCsvColumnMapping(parser.headers, nautobotFields)
  // Manages: step, defaults, prefixConfig, dryRunErrors, importProgress, importSummary
  // handleFileSelect delegates to parser and post-processes mapping
}
```

**Migration steps:**
1. Create `use-csv-parser.ts` and extract FileReader logic
2. Create `use-csv-column-mapping.ts` and extract mapping state
3. Update `use-csv-import.ts` to compose them
4. Update `hooks/index.ts` exports
5. Run `npm run lint` to verify no regressions

---

### 3.2 Extract validation logic from `add-device-page.tsx`

**File:** `src/components/features/nautobot/add-device/add-device-page.tsx` (659 lines, target ≤ 500)

**After Phase 2.3** the page is ~570 lines. The remaining large block is the `handleImportDevice` function and the manual `handleValidate` logic.

**Extract to:** `hooks/use-device-import.ts` (new file)

```typescript
// hooks/use-device-import.ts
export function useDeviceImport(form: UseFormReturn<DeviceFormValues>, onSuccess: () => void) {
  // handleImportDevice callback (~50 lines from add-device-page.tsx)
  // handleValidate callback
  // importSummary state
}
```

**After all Phase 3 work**, `add-device-page.tsx` should be ~400 lines.

---

## Phase 4 — Medium Quality Improvements (1 day)

### 4.1 Explicit UTF-8 encoding in FileReader calls

**Files:**
- `use-csv-parser.ts` (after Phase 3 extraction)

**Fix:**
```typescript
// ❌ Implicit encoding
reader.readAsText(file)

// ✅ Explicit encoding
reader.readAsText(file, 'utf-8')
```

---

### 4.2 Stabilize `interfaceId` to use real IDs, not array indices

**File:** `src/components/features/nautobot/add-device/components/interface-properties-modal.tsx`, lines 43–47

**Problem:** `interfaceId` is passed as the array index stringified. If interfaces are reordered the wrong interface's modal opens.

**Fix:** Add a stable `id` field (e.g. `crypto.randomUUID()`) to each interface when it is added:

```typescript
// In use-device-form.ts, when adding an interface:
const newInterface: InterfaceFormValues = {
  id: crypto.randomUUID(),
  // ... other fields
}
```

Then use `interface.id` as the lookup key in the modal instead of `parseInt(interfaceId, 10)`.

---

### 4.3 `use-tags-manager.ts` — accept initial tags

**File:** `src/components/features/nautobot/add-device/hooks/use-tags-manager.ts`, line 24

**Problem:** Tags are always initialized empty, so editing a device with pre-existing tags loses them.

**Fix:**
```typescript
const EMPTY_STRING_ARRAY: string[] = []

export function useTagsManager(initialTags: string[] = EMPTY_STRING_ARRAY) {
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)
  // ...
}
```

---

### 4.4 Type the Nautobot API responses instead of `any`

**File:** `src/components/features/nautobot/add-device/hooks/queries/use-nautobot-dropdowns-query.ts`

**Problem:** Multiple `apiCall<any>` calls with eslint-disable comments.

**Fix:** Add a typed response shape:

```typescript
// In types.ts or use-nautobot-dropdowns-query.ts
interface NautobotListResponse<T> {
  results: T[]
  count: number
}

interface NautobotDropdownItem {
  id: string
  name: string
  display: string
}
```

Then replace `apiCall<any>` with `apiCall<NautobotListResponse<NautobotDropdownItem>>` for each dropdown endpoint, removing all eslint-disable comments.

---

## Execution Order & Verification Checklist

Execute phases in order. Each phase must be lint-clean before starting the next.

```
Phase 1 — Dead code removal
  [ ] Delete interface-list.tsx.backup-...
  [ ] Delete use-csv-upload.ts + remove exports + clean test mocks
  [ ] Delete csv-upload-modal.tsx + remove exports + clean test mocks
  [ ] Delete bulk-update-modal.tsx + remove exports
  [ ] Run: npm run lint → 0 errors
  [ ] Run: npm test → all pass

Phase 2 — Bug fixes
  [ ] Fix Tailwind dynamic class in status-alert.tsx
  [ ] Remove console.error wall from add-device-page.tsx onInvalid
  [ ] Run: npm run lint → 0 errors
  [ ] Run: npm test → all pass
  [ ] Visual check: success/info alert borders visible in browser

Phase 3 — Hook splitting
  [ ] Create use-csv-parser.ts
  [ ] Create use-csv-column-mapping.ts
  [ ] Update use-csv-import.ts to compose them
  [ ] Update hooks/index.ts
  [ ] Create use-device-import.ts
  [ ] Update add-device-page.tsx to use new hooks
  [ ] Run: npm run lint → 0 errors
  [ ] Run: npm test → all pass
  [ ] Verify wc -l: use-csv-import.ts < 300 lines, add-device-page.tsx < 500 lines

Phase 4 — Medium improvements
  [ ] Explicit UTF-8 in FileReader
  [ ] Stable interfaceId via crypto.randomUUID()
  [ ] useTagsManager initialTags support
  [ ] Type NautobotDropdownItem, remove all eslint-disable-next-line @typescript-eslint/no-explicit-any
  [ ] Run: npm run lint → 0 errors
  [ ] Run: npm test → all pass
```

---

## Files Affected Summary

| File | Action |
|---|---|
| `components/interface-list.tsx.backup-*` | DELETE |
| `hooks/use-csv-upload.ts` | DELETE |
| `components/csv-upload-modal.tsx` | DELETE |
| `components/bulk-update-modal.tsx` | DELETE |
| `components/status-alert.tsx` | FIX (Tailwind class) |
| `add-device-page.tsx` | FIX (console.error) + SHRINK (extract hook) |
| `hooks/use-csv-import.ts` | SPLIT into 3 focused hooks |
| `hooks/index.ts` | REMOVE dead exports |
| `components/index.ts` | REMOVE dead exports |
| `add-device-page.test.tsx` | REMOVE dead mocks |
| `hooks/use-csv-parser.ts` | NEW |
| `hooks/use-csv-column-mapping.ts` | NEW |
| `hooks/use-device-import.ts` | NEW |
| `components/interface-properties-modal.tsx` | FIX (stable IDs) |
| `hooks/use-tags-manager.ts` | FIX (initialTags) |
| `hooks/queries/use-nautobot-dropdowns-query.ts` | FIX (typed responses) |
