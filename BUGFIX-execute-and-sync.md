# Bug Fix: Execute-and-Sync Template Rendering

## Issue
When executing templates via the netmiko app using "Execute" button, templates failed with error:
```
'nautobot' is undefined
```

The pre-run command was also not being executed during template execution (only worked in "Test Template").

## Root Cause

The `/api/templates/execute-and-sync` endpoint was using the OLD `template_manager.render_template()` method, which:
- ❌ Does NOT support Nautobot context (`nautobot.id`, `nautobot.name`)
- ❌ Does NOT support pre-run commands (`pre_run_parsed`)
- ❌ Does NOT use the modern render service

Meanwhile, the `/api/templates/render` endpoint (used by "Test Template") was using the NEW `render_service.render_template()` method, which:
- ✅ Supports Nautobot context
- ✅ Supports pre-run commands
- ✅ Supports credential-based command execution

This created inconsistent behavior between testing and executing templates.

## Fix

Updated `/backend/routers/settings/templates.py` (lines 969-1001) to:

1. **Use `render_service.render_template()`** instead of `template_manager.render_template()`
2. **Pass template configuration** including:
   - `use_nautobot_context` from template settings
   - `pre_run_command` from template settings
   - `credential_id` from template settings
3. **Capture warnings** from render service

### Before (Broken):
```python
rendered_content = template_manager.render_template(
    template_name=template['name'],
    category=template['category'],
    data={
        'device_id': device_id,
        'user_variables': request.user_variables or {},
    }
)
```

### After (Fixed):
```python
result = await render_service.render_template(
    template_content=template_content,
    category=template['category'],
    device_id=device_id,
    user_variables=request.user_variables or {},
    use_nautobot_context=template.get('use_nautobot_context', True),
    pre_run_command=template.get('pre_run_command'),
    credential_id=template.get('credential_id'),
)

rendered_content = result["rendered_content"]
```

## Impact

### Before Fix
- ✅ "Test Template" worked (used new render service)
- ❌ "Execute" failed ('nautobot' undefined)
- ❌ Pre-run commands not executed during execution
- ❌ Inconsistent behavior between test and execute

### After Fix
- ✅ "Test Template" works (unchanged)
- ✅ "Execute" works (now uses same render service)
- ✅ Pre-run commands execute in both test and execute
- ✅ Consistent behavior between test and execute
- ✅ Templates can use `nautobot.id`, `nautobot.name`, `pre_run_parsed`

## Testing

1. Create a template with:
   - `use_nautobot_context`: enabled
   - `pre_run_command`: `show ip int brief`
   - Template content using `{{ nautobot.id }}` and `{{ pre_run_parsed }}`

2. Click "Test Template" → Should work ✅
3. Click "Execute" → Should now work ✅ (was failing before)

## Related Changes

Also fixed frontend to pass `pre_run_command` and `credential_id` when testing templates:
- Updated `/frontend/src/components/features/network/automation/netmiko/types/index.ts`
- Updated `/frontend/src/components/features/network/automation/netmiko/tabs/variables-and-templates-tab.tsx`

## Date
2026-01-06
