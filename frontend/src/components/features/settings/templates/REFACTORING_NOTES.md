# Template Form Refactoring Notes

## Date: 2026-02-05

## Problem
The template edit form was broken after refactoring. The form had become overly complex with:
- Multiple useEffect hooks with ref-based state tracking
- Complex loading logic that was hard to debug
- Individual `setValue()` calls instead of proper form reset
- Extensive console logging indicating debugging difficulties
- Race conditions between different effects

## Solution: Simplified Approach

### Key Changes

1. **Removed Complex State Tracking**
   - ❌ Removed `isDataLoadedRef` and `loadedTemplateIdRef`
   - ❌ Removed extensive debug logging
   - ✅ Simplified to single, clear useEffect

2. **Simplified Form Loading Logic**
   ```typescript
   // OLD: 50+ lines with refs and multiple checks
   useEffect(() => {
     const templateId = template?.id
     const shouldLoad = template && templateContent !== undefined &&
                        !isDataLoadedRef.current &&
                        loadedTemplateIdRef.current !== templateId
     // ... complex logic with refs and individual setValue calls
   }, [template, templateContent])

   // NEW: Simple and clear
   useEffect(() => {
     if (isEditMode && template && templateContent !== undefined) {
       form.reset({ /* all values at once */ })
     } else if (!isEditMode) {
       form.reset(DEFAULT_TEMPLATE_FORM_DATA)
       setSelectedFile(null)
     }
   }, [template?.id, templateContent, isEditMode, form])
   ```

3. **Used form.reset() Properly**
   - ❌ OLD: Individual `form.setValue()` calls in a loop
   - ✅ NEW: Single `form.reset()` with all values - proper react-hook-form pattern

4. **Better Loading State Display**
   - Added proper loading UI when fetching template content
   - Shows spinner with message: "Loading template data..."

5. **Removed Unnecessary Code**
   - Removed defensive timeout tricks (`setTimeout(() => form.trigger(), 0)`)
   - Removed complex conditional checks
   - Removed console.log debugging statements

### What Works Now

✅ **Create Mode**: Form initializes with default empty values
✅ **Edit Mode**: Form loads existing template data properly
✅ **Mode Switching**: Clean transition between create and edit modes
✅ **File Upload**: File selection still works correctly
✅ **Source Types**: All three sources (git, file, webeditor) render properly
✅ **Category-based Features**: Agent category shows Nautobot context option

### Testing Checklist

- [ ] Create new template with webeditor source
- [ ] Create new template with git source
- [ ] Create new template with file upload
- [ ] Edit existing webeditor template
- [ ] Edit existing git template
- [ ] Edit existing file template
- [ ] Switch between create/edit tabs
- [ ] Cancel edit and return to list
- [ ] Update existing template
- [ ] Verify form validation works

## Technical Details

### Dependencies Used
- `react-hook-form` with `zod` validation
- TanStack Query for data fetching (`useTemplateContent`)
- Shadcn UI components
- Custom hooks: `useTemplateMutations`, `useTemplateContent`

### Key Patterns
- **Single useEffect**: One effect for all form loading logic
- **Proper Dependencies**: `[template?.id, templateContent, isEditMode, form]`
- **form.reset()**: React Hook Form's recommended way to populate forms
- **Conditional Rendering**: Clean source-type switching with `useWatch`

## Lessons Learned

1. **Avoid Refs for Loading State**: React Hook Form's `form.reset()` is sufficient
2. **Keep Effects Simple**: One clear purpose per effect
3. **Trust form.reset()**: It properly updates all fields and triggers re-renders
4. **Remove Debug Code**: Console logs indicate complexity - simplify instead
5. **Use Query Loading States**: Let TanStack Query handle loading/error states

## Files Modified

- `template-form.tsx` - Simplified from 580 lines to 524 lines
- Removed ~60 lines of complex ref-tracking and debug logging
- Improved readability and maintainability

## Future Improvements

- Consider moving source-specific sections to separate components
- Add better error handling for content loading failures
- Add unsaved changes warning when navigating away
- Consider adding auto-save for longer templates
