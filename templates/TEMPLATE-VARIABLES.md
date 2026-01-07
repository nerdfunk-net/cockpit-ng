# Template Variable Reference

## Quick Reference

**For "show ip int" interface updates:**

```jinja2
{
  "id": "{{ nautobot.id }}",              ← Device UUID
  "interfaces": [
{%- for iface in pre_run_parsed %}        ← Your parsed command output!
    {
      "name": "{{ iface.interface }}",
      "ip_address": "{{ iface.ip_address[0] }}/{{ iface.prefix_length[0] }}",
      "namespace": "{{ user_variables.namespace_id|default('Global') }}"  ← Optional config
    }
{%- endfor %}
  ]
}
```

**Key Points:**
- ✅ Use `nautobot.id` for device ID
- ✅ Use `pre_run_parsed` for interface data from commands
- ✅ Use `user_variables` only for optional configuration (like namespace_id)
- ❌ Don't use `device_id`, `data`, or `user_variables.interfaces`

---

## Available Context Variables

When your Jinja2 template is rendered by the `/api/templates/render` or `/api/templates/execute-and-sync` endpoints, these variables are available:

### 1. `nautobot` - Device Context from Nautobot

Access device information from Nautobot:

- **`nautobot.id`** - Device UUID (string)
- **`nautobot.name`** - Device name (string)
- Other Nautobot device fields are available depending on what's fetched

**Example:**
```jinja2
{
  "id": "{{ nautobot.id }}",
  "name": "{{ nautobot.name }}"
}
```

### 2. `pre_run_output` - Raw Command Output

The raw text output from your pre-run command (if specified).

**Example:**
```jinja2
Raw output:
{{ pre_run_output }}
```

### 3. `pre_run_parsed` - Parsed Command Output ⭐ PRIMARY DATA SOURCE

**⭐ THIS IS WHAT YOU WANT FOR "SHOW IP INT"!**

The parsed JSON/YAML output from your pre-run command. If you use TextFSM to parse "show ip int", the structured data is here as an array.

**This is your main data source for interface information!**

**Example:**
```jinja2
{
  "id": "{{ nautobot.id }}",
  "interfaces": [
{%- for interface in pre_run_parsed %}
    {
      "name": "{{ interface.interface }}",
      "status": "{{ interface.link_status }}",
      "ip_address": "{{ interface.ip_address[0] }}/{{ interface.prefix_length[0] }}"
    }{% if not loop.last %},{% endif %}
{%- endfor %}
  ]
}
```

### 4. `user_variables` - Custom Variables (Optional)

**Use case:** Additional configuration options, NOT your main data source!

Use `user_variables` for:
- ✅ Namespace IDs
- ✅ Custom settings/flags
- ✅ Optional overrides

**Do NOT use for:** Interface data (use `pre_run_parsed` instead!)

**Example API Request:**
```json
{
  "template_id": 123,
  "device_ids": ["device-uuid"],
  "user_variables": {
    "namespace_id": "my-namespace-uuid",
    "set_all_active": true
  }
}
```

**In Template:**
```jinja2
{%- for iface in pre_run_parsed %}
  {
    "name": "{{ iface.interface }}",
    "namespace": "{{ user_variables.namespace_id|default('Global') }}",
    "status": "{% if user_variables.set_all_active %}active{% else %}{{ iface.link_status }}{% endif %}"
  }
{%- endfor %}
```

## Complete Example

### Template with Pre-Run Command

```jinja2
{#
  This template uses data from a "show ip int" command
  that has been parsed with TextFSM
#}
{
  "id": "{{ nautobot.id }}",
  "device_name": "{{ nautobot.name }}",
  "interfaces": [
{%- for iface in pre_run_parsed %}
{%- if iface.ip_address and iface.ip_address|length > 0 %}
    {
      "name": "{{ iface.interface }}",
      "type": "1000base-t",
      "status": "{% if iface.link_status == 'up' %}active{% else %}failed{% endif %}",
      "ip_address": "{{ iface.ip_address[0] }}/{{ iface.prefix_length[0] }}",
      "namespace": "{{ user_variables.namespace_id|default('Global') }}",
      "is_primary_ipv4": {% if loop.first %}true{% else %}false{% endif %}
    }{% if not loop.last %},{% endif %}
{%- endif %}
{%- endfor %}
  ]
}
```

### API Call

```bash
curl -X POST http://localhost:8000/api/templates/execute-and-sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": 123,
    "device_ids": ["device-uuid"],
    "output_format": "json",
    "user_variables": {
      "namespace_id": "Global"
    }
  }'
```

## Common Mistakes

### ❌ WRONG - Using undefined `device_id`
```jinja2
{
  "id": "{{ device_id }}"  # device_id doesn't exist!
}
```

### ✅ CORRECT - Using `nautobot.id`
```jinja2
{
  "id": "{{ nautobot.id }}"  # This exists!
}
```

---

### ❌ WRONG - Using undefined `data` variable
```jinja2
{%- for iface in data %}  # "data" doesn't exist!
```

### ✅ CORRECT - Using `pre_run_parsed`
```jinja2
{%- for iface in pre_run_parsed %}  # This exists!
```

---

### ❌ WRONG - Using `user_variables.interfaces` for command output
```jinja2
{%- for iface in user_variables.interfaces %}  # This is NOT where command output goes!
```

### ✅ CORRECT - Using `pre_run_parsed` for command output
```jinja2
{%- for iface in pre_run_parsed %}  # This is where your "show ip int" data is!
```

---

### ❌ WRONG - Using `zip()` function
```jinja2
{%- for ip, prefix in zip(ips, prefixes) %}  # zip() not available in Jinja2!
```

### ✅ CORRECT - Using `range()` and indexing
```jinja2
{%- for i in range(ips|length) %}
  IP: {{ ips[i] }}/{{ prefixes[i] }}
{%- endfor %}
```

## Variable Precedence

If the same variable name appears in multiple sources:

1. **Template context** (nautobot, pre_run_parsed, etc.) - Highest priority
2. **user_variables** - Can override if not conflicting
3. **Defaults** - Use Jinja2 default filter: `{{ var|default('fallback') }}`

## Debugging Variables

To see what variables are available, create a debug template:

```jinja2
Available variables:
- nautobot.id: {{ nautobot.id }}
- nautobot.name: {{ nautobot.name }}
- pre_run_output: {{ pre_run_output|truncate(100) }}
- pre_run_parsed: {{ pre_run_parsed|tojson }}
- user_variables: {{ user_variables|tojson }}
```

This will show you exactly what data is available in your template context.
