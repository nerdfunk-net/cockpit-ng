# Template Rendering with Variable Metadata - Implementation Notes

## 🎯 Overview

Templates now store variables with **type** and **metadata**, allowing Celery tasks to regenerate fresh data instead of using stale cached values. This document outlines what needs to be considered when implementing template rendering in Celery tasks.

---

## 📊 What Changed

### Before (Old Format):
```json
{
  "my_var": "static value",
  "nautobot_locations": "[{...cached data...}]"
}
```

### After (New Format):
```json
{
  "my_var": {
    "value": "static value",
    "type": "custom",
    "metadata": {}
  },
  "nautobot_locations": {
    "value": "[{...cached data...}]",
    "type": "nautobot",
    "metadata": {
      "nautobot_source": "locations"
    }
  }
}
```

---

## 🗂️ Key Files to Reference

### Frontend (for understanding variable creation):
- `/frontend/src/components/features/templates/editor/types/index.ts` - Variable type definitions
- `/frontend/src/components/features/templates/editor/dialogs/tabs/nautobot-data-tab.tsx` - How Nautobot variables are created
- `/frontend/src/components/features/templates/editor/dialogs/tabs/yaml-file-tab.tsx` - How YAML variables are created
- `/frontend/src/components/features/templates/editor/dialogs/tabs/inventory-metadata-tab.tsx` - How inventory variables are created
- `/frontend/src/components/features/templates/editor/components/template-editor-page.tsx` - How variables are saved (line ~405-423)

### Backend (for implementation):
- `/backend/core/models.py` (line 756+) - Template model with `variables` column
- `/backend/routers/settings/templates.py` (line 759+) - `advanced_render_template` endpoint (reference implementation)
- `/backend/services/nautobot/` - Nautobot API services
- `/backend/repositories/inventory_repository.py` - Inventory data access
- `/backend/template_manager.py` - Template loading and management

### Existing Job/Task Files:
- `/backend/tasks/job_tasks.py` - Existing Celery tasks (check how they currently use templates)
- `/backend/tasks/execution/command_executor.py` - Command execution tasks

---

## 🔑 Variable Types and How to Handle Them

### 1. **Custom Variables** (`type: "custom"`)
**Purpose:** Static user-defined values that never change.

**Metadata:** None (empty object)

**Handling:**
```python
def populate_custom_variable(var_def: dict) -> Any:
    """
    Custom variables - use stored value as-is.
    Value is already a string, may contain JSON.
    """
    value_str = var_def["value"]

    # Try to parse as JSON, fall back to string
    try:
        return json.loads(value_str)
    except json.JSONDecodeError:
        return value_str
```

**Example:**
```json
{
  "hostname_prefix": {
    "value": "prod",
    "type": "custom",
    "metadata": {}
  }
}
```

---

### 2. **Nautobot Variables** (`type: "nautobot"`)
**Purpose:** Fetch fresh data from Nautobot API.

**Metadata:**
- `nautobot_source`: One of `"locations"`, `"tags"`, `"custom-fields"`, `"statuses"`, `"roles"`, `"namespaces"`

**Handling:**
```python
def populate_nautobot_variable(var_def: dict, nautobot_service) -> Any:
    """
    Nautobot variables - fetch fresh from API.

    Important: Always fetch FRESH data, ignore cached value.
    """
    metadata = var_def.get("metadata", {})
    source = metadata.get("nautobot_source")

    if not source:
        raise ValueError("Nautobot variable missing 'nautobot_source' in metadata")

    # Map source to API endpoint
    endpoint_map = {
        "locations": "nautobot/locations",
        "tags": "nautobot/tags",
        "custom-fields": "nautobot/custom-fields/devices",
        "statuses": "nautobot/statuses",
        "roles": "nautobot/roles",
        "namespaces": "nautobot/namespaces",
    }

    # Fetch fresh data from Nautobot
    # Use existing nautobot service methods
    if source == "locations":
        return nautobot_service.get_locations()
    elif source == "tags":
        return nautobot_service.get_tags()
    # ... etc for other types

    raise ValueError(f"Unknown nautobot_source: {source}")
```

**Example:**
```json
{
  "nautobot_locations": {
    "value": "[...cached for preview only...]",
    "type": "nautobot",
    "metadata": {
      "nautobot_source": "locations"
    }
  }
}
```

**⚠️ Critical:** NEVER use the cached `value` field! Always fetch fresh data.

---

### 3. **YAML File Variables** (`type: "yaml"`)
**Purpose:** Load and parse YAML files from Git repositories.

**Metadata:**
- `yaml_file_path`: Path to YAML file in repository (e.g., `/configs/device.yaml`)
- `yaml_file_id`: Repository ID where file is stored

**Handling:**
```python
def populate_yaml_variable(var_def: dict) -> Any:
    """
    YAML variables - reload file from Git repository.

    Important: Always reload FRESH file content, ignore cached value.
    """
    metadata = var_def.get("metadata", {})
    file_path = metadata.get("yaml_file_path")
    repo_id = metadata.get("yaml_file_id")

    if not file_path or not repo_id:
        raise ValueError("YAML variable missing 'yaml_file_path' or 'yaml_file_id' in metadata")

    # Use existing git repository service
    from template_manager import template_manager

    # Fetch file content from git repository
    file_content = template_manager.get_file_from_repo(repo_id, file_path)

    # Parse YAML
    import yaml
    parsed_data = yaml.safe_load(file_content)

    return parsed_data
```

**Example:**
```json
{
  "device_config": {
    "value": "{...cached for preview only...}",
    "type": "yaml",
    "metadata": {
      "yaml_file_path": "/configs/router_template.yaml",
      "yaml_file_id": 123
    }
  }
}
```

**⚠️ Critical:** NEVER use the cached `value` field! Always reload from Git.

---

### 4. **Inventory Variables** (`type: "inventory"`)
**Purpose:** Re-analyze inventory to get fresh metadata (locations, tags, custom fields, etc.).

**Metadata:**
- `inventory_id`: ID of the inventory to analyze
- `inventory_data_type`: One of `"locations"`, `"tags"`, `"custom_fields"`, `"statuses"`, `"roles"`
- `inventory_custom_field`: (Optional) Name of custom field if `inventory_data_type` is `"custom_fields"`

**Handling:**
```python
def populate_inventory_variable(var_def: dict, inventory_service) -> Any:
    """
    Inventory variables - re-analyze inventory for fresh metadata.

    Important: Always re-analyze, ignore cached value.
    """
    metadata = var_def.get("metadata", {})
    inventory_id = metadata.get("inventory_id")
    data_type = metadata.get("inventory_data_type")
    custom_field = metadata.get("inventory_custom_field")

    if not inventory_id or not data_type:
        raise ValueError("Inventory variable missing 'inventory_id' or 'inventory_data_type' in metadata")

    # Use existing inventory service to analyze
    analyze_result = inventory_service.analyze_inventory(inventory_id)

    # Extract the requested data type
    if data_type == "custom_fields":
        if not custom_field:
            raise ValueError("Inventory variable with data_type='custom_fields' missing 'inventory_custom_field'")
        return analyze_result["custom_fields"].get(custom_field, [])
    else:
        return analyze_result.get(data_type, [])
```

**Example:**
```json
{
  "inventory_locations": {
    "value": "[...cached for preview only...]",
    "type": "inventory",
    "metadata": {
      "inventory_id": 42,
      "inventory_data_type": "locations"
    }
  },
  "inventory_site_code": {
    "value": "[...cached for preview only...]",
    "type": "inventory",
    "metadata": {
      "inventory_id": 42,
      "inventory_data_type": "custom_fields",
      "inventory_custom_field": "site_code"
    }
  }
}
```

**⚠️ Critical:** NEVER use the cached `value` field! Always re-analyze inventory.

---

## 🔄 Template Rendering Flow (Celery Task)

### Step-by-Step Process:

```python
def render_template_in_celery_task(template_id: int, context: dict) -> str:
    """
    Complete flow for rendering a template in a Celery task.

    Args:
        template_id: ID of template to render
        context: Runtime context (inventory_id, device_id, etc.)

    Returns:
        Rendered template content
    """

    # 1. Load template from database
    from template_manager import template_manager
    template = template_manager.get_template(template_id)

    if not template:
        raise ValueError(f"Template {template_id} not found")

    # 2. Parse stored variables (JSON string → dict)
    stored_variables = json.loads(template.get("variables", "{}"))

    # 3. Populate user-defined variables based on type
    populated_vars = {}

    for var_name, var_def in stored_variables.items():
        var_type = var_def.get("type", "custom")  # Default to custom for backwards compatibility

        try:
            if var_type == "custom":
                populated_vars[var_name] = populate_custom_variable(var_def)

            elif var_type == "nautobot":
                populated_vars[var_name] = populate_nautobot_variable(var_def, nautobot_service)

            elif var_type == "yaml":
                populated_vars[var_name] = populate_yaml_variable(var_def)

            elif var_type == "inventory":
                populated_vars[var_name] = populate_inventory_variable(var_def, inventory_service)

            else:
                logger.warning(f"Unknown variable type '{var_type}' for variable '{var_name}', using cached value")
                populated_vars[var_name] = populate_custom_variable(var_def)

        except Exception as e:
            logger.error(f"Failed to populate variable '{var_name}': {e}")
            # Decide: skip variable, use cached value, or fail task?
            # For now, use cached value as fallback
            populated_vars[var_name] = populate_custom_variable(var_def)

    # 4. Add auto-filled variables based on template category
    category = template.get("category", "__none__")

    if category == "agent":
        # Add agent-specific auto-filled variables
        inventory_id = context.get("inventory_id")
        if inventory_id:
            # Fetch devices from inventory
            devices = inventory_service.get_devices_from_inventory(inventory_id)
            populated_vars["devices"] = devices

            # Add device_details if use_nautobot_context is true
            if template.get("use_nautobot_context", False):
                device_details = []
                for device in devices:
                    details = nautobot_service.get_device_details(device["id"])
                    device_details.append(details)
                populated_vars["device_details"] = device_details

            # Add snmp_mapping if pass_snmp_mapping is true
            if template.get("pass_snmp_mapping", False):
                snmp_mapping = config_service.load_snmp_mapping()
                populated_vars["snmp_mapping"] = snmp_mapping

            # Add path if specified
            if template.get("file_path"):
                populated_vars["path"] = template.get("file_path")

    elif category == "netmiko":
        # Add netmiko-specific auto-filled variables
        device_id = context.get("device_id")
        if device_id:
            # Fetch single device
            device = nautobot_service.get_device(device_id)
            populated_vars["devices"] = [device]

            # Add device_details if use_nautobot_context is true
            if template.get("use_nautobot_context", False):
                device_details = nautobot_service.get_device_details(device_id)
                populated_vars["device_details"] = device_details

            # Execute pre_run_command if specified
            if template.get("pre_run_command"):
                credential_id = template.get("credential_id")
                pre_run_output = execute_pre_run_command(
                    device_id,
                    template.get("pre_run_command"),
                    credential_id
                )
                populated_vars["pre_run"] = {
                    "raw": pre_run_output.get("raw", ""),
                    "parsed": pre_run_output.get("parsed", [])
                }

    # 5. Render template with Jinja2
    from jinja2 import Template as Jinja2Template

    template_content = template.get("content", "")
    jinja_template = Jinja2Template(template_content)
    rendered_content = jinja_template.render(**populated_vars)

    return rendered_content
```

---

## 🎯 Integration Points

### Where Celery Tasks Use Templates:

1. **Job Execution** (`/backend/tasks/job_tasks.py`)
   - Job templates are rendered with inventory data
   - Need to update to use new variable system

2. **Scheduled Tasks** (if any)
   - May render templates periodically
   - Need to update to fetch fresh data

3. **Agent Deployments** (if any)
   - May render config templates
   - Need to update to use new variable system

### Services to Use:

- **NautobotService** - Fetch Nautobot data (`/backend/services/nautobot/client.py`)
- **InventoryRepository** - Access inventory data (`/backend/repositories/inventory_repository.py`)
- **TemplateManager** - Load templates and files (`/backend/template_manager.py`)
- **ConfigService** - Load SNMP mappings (in `advanced_render_template` endpoint)

---

## ⚠️ Critical Considerations

### 1. **Error Handling**
- What happens if Nautobot API is down?
- What if YAML file doesn't exist in Git?
- What if inventory analysis fails?

**Options:**
- Use cached value as fallback
- Fail the task and retry later
- Skip the variable and continue

**Recommendation:** Log error, use cached value as fallback, add warning to task result.

### 2. **Performance**
- Fetching fresh data for all variables can be slow
- Multiple API calls per template render

**Optimization Ideas:**
- Cache Nautobot data for short duration (5-10 minutes)
- Batch fetch when possible
- Use async/await for parallel fetching

### 3. **Backwards Compatibility**
- Old templates may still have old variable format
- Migration may not have run yet

**Handling:**
```python
# Check if variable is in old or new format
if isinstance(var_value, dict) and "type" in var_value:
    # New format
    populate_by_type(var_value)
else:
    # Old format - treat as custom variable
    populated_vars[var_name] = json.loads(var_value) if var_value else var_value
```

### 4. **Testing**
Test each variable type:
- ✅ Custom variables work
- ✅ Nautobot variables fetch fresh data
- ✅ YAML variables reload files
- ✅ Inventory variables re-analyze
- ✅ Auto-filled variables populate correctly
- ✅ Backwards compatibility with old format
- ✅ Error handling when API fails

---

## 📝 Implementation Checklist

When implementing template rendering in Celery tasks:

- [ ] Update task to load template with new variable format
- [ ] Implement `populate_custom_variable()`
- [ ] Implement `populate_nautobot_variable()` with fresh API calls
- [ ] Implement `populate_yaml_variable()` with file reloading
- [ ] Implement `populate_inventory_variable()` with re-analysis
- [ ] Add auto-filled variables based on category
- [ ] Add error handling with fallbacks
- [ ] Add backwards compatibility for old format
- [ ] Add logging for debugging
- [ ] Write unit tests for each variable type
- [ ] Write integration tests for full render flow
- [ ] Update documentation
- [ ] Test with real templates in dev environment

---

## 🔍 Reference: Existing Render Implementation

The `advanced_render_template` endpoint in `/backend/routers/settings/templates.py` (line 759+) shows how rendering currently works for **preview**. You can reference this for:

- How to populate auto-filled variables (devices, device_details, etc.)
- How to fetch Nautobot data
- How to load SNMP mappings
- How to execute pre_run commands
- How to render with Jinja2

**Key difference:** Preview uses runtime parameters from frontend. Celery tasks load everything from the saved template.

---

## 🚀 Next Steps

1. Read the referenced files to understand current implementation
2. Identify all Celery tasks that render templates
3. Implement variable population functions
4. Update Celery tasks to use new system
5. Test thoroughly with all variable types
6. Deploy to dev environment
7. Monitor for issues
8. Document any edge cases discovered

---

## 📚 Additional Resources

- **Jinja2 Documentation:** https://jinja.palletsprojects.com/
- **Frontend Variable Types:** `/frontend/src/components/features/templates/editor/types/index.ts`
- **Migration File:** `/backend/migrations/versions/007_template_variables_metadata.py`
- **Summary Document:** `/tmp/variable_metadata_summary.md` (from implementation session)

---

## ⚡ Quick Reference: Variable Metadata Structure

```typescript
// TypeScript types (frontend)
type VariableType = 'custom' | 'nautobot' | 'yaml' | 'inventory' | 'auto-filled'

interface VariableDefinition {
  name: string
  value: string  // Cached value for preview
  type: VariableType
  metadata?: {
    // Nautobot
    nautobot_source?: 'locations' | 'tags' | 'custom-fields' | 'statuses' | 'roles' | 'namespaces'

    // YAML
    yaml_file_path?: string
    yaml_file_id?: number

    // Inventory
    inventory_id?: number
    inventory_data_type?: 'locations' | 'tags' | 'custom_fields' | 'statuses' | 'roles'
    inventory_custom_field?: string  // Only for custom_fields
  }
}
```

```python
# Python structure (backend)
{
  "variable_name": {
    "value": "cached string value",
    "type": "nautobot",  # or "custom", "yaml", "inventory"
    "metadata": {
      "nautobot_source": "locations"
    }
  }
}
```

---

**Last Updated:** 2026-02-14
**Migration:** 007_template_variables_metadata
**Status:** ✅ Frontend complete, ⏳ Backend implementation needed
