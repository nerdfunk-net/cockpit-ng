# Interface Update Templates for Nautobot

## Overview

The `/api/templates/execute-and-sync` endpoint now supports creating and updating multiple interfaces on devices in Nautobot. This allows you to:

1. Run commands on devices (e.g., `show ip int`)
2. Parse the output with templates
3. Automatically create interfaces and assign IP addresses in Nautobot

## Quick Start

**For your "show ip int" use case, use the `show-ip-int-basic.j2` template:**

1. Upload the template to Cockpit-NG
2. Set up a template with:
   - **Pre-run command**: The command that outputs your interface data
   - **Template content**: Use `show-ip-int-basic.j2`
3. The template automatically uses:
   - `nautobot.id` - The device UUID
   - `pre_run_parsed` - Your parsed "show ip int" JSON data
4. Call `/api/templates/execute-and-sync` with `output_format: "json"`
5. Interfaces and IPs are created in Nautobot automatically!

## Template Context Variables

When your template renders, these variables are available:

- **`nautobot.id`** - Device UUID (use this for the "id" field)
- **`nautobot.name`** - Device name
- **`pre_run_output`** - Raw output from pre-run command
- **`pre_run_parsed`** - Parsed JSON/YAML from pre-run command (use this for interface data!)
- **`user_variables`** - Any custom variables you pass via API

## How It Works

### Step 1: Template Execution

Your Jinja2 template should output JSON in this format:

```json
{
  "id": "{{ nautobot.id }}",
  "interfaces": [
    {
      "name": "Ethernet0/0",
      "type": "1000base-t",
      "status": "active",
      "ip_address": "192.168.1.1/24",
      "namespace": "Global",
      "is_primary_ipv4": true,
      "enabled": true,
      "description": "Management interface"
    },
    {
      "name": "Ethernet0/1",
      "type": "1000base-t",
      "status": "active",
      "ip_address": "10.0.0.1/30",
      "namespace": "Global",
      "enabled": true
    }
  ]
}
```

### Step 2: Backend Processing

The backend will:

1. Look up the device by ID or name
2. For each interface:
   - Create the IP address in Nautobot IPAM (or use existing)
   - Create the interface on the device
   - Assign the IP address to the interface
3. Set the primary IPv4 address if specified

## Required Fields

### Device Object
- `id`: Device UUID or name (required)
- `interfaces`: Array of interface objects (optional, but needed to create interfaces)

### Interface Object
- `name`: Interface name (required) - e.g., "Ethernet0/0", "GigabitEthernet1/0/1"
- `type`: Interface type (required) - e.g., "1000base-t", "10gbase-x-sfpp", "virtual"
- `status`: Interface status (required) - e.g., "active", "planned", "failed"

### Optional Interface Fields
- `ip_address`: IP address with CIDR notation (e.g., "192.168.1.1/24")
- `namespace`: Namespace for the IP address (defaults to "Global")
- `is_primary_ipv4`: Set to `true` to mark as device primary IPv4
- `enabled`: Boolean, whether interface is enabled
- `mgmt_only`: Boolean, whether interface is management only
- `description`: Interface description
- `mac_address`: MAC address
- `mtu`: MTU value (integer)
- `mode`: Interface mode ("access", "tagged", "tagged-all")

## Example Templates

### 1. Simple Example (`simple-interface-update.j2`)
Minimal working example showing required fields. Good for learning the structure.

### 2. Basic "Show IP Int" Parser (`show-ip-int-basic.j2`) ⭐ RECOMMENDED
**Best for getting started!**

Parses Cisco "show ip int" output with these features:
- Uses FIRST IP address per interface (if multiple exist)
- Automatically infers interface types from names
- Maps Cisco link status to Nautobot status values
- Sets first interface as primary IPv4
- Easy to understand and modify

### 3. Advanced "Show IP Int" Parser (`update-device-interfaces.j2`)
Full-featured template that:
- Handles multiple IPs per interface (creates separate interface entries)
- More sophisticated type inference
- Includes VRF and MTU fields
- More complex but more powerful

## Interface Type Mapping

Common Cisco interface types map to Nautobot types:

| Cisco Interface | Nautobot Type |
|----------------|---------------|
| Ethernet*, GigabitEthernet* | 1000base-t |
| FastEthernet* | 100base-tx |
| TenGigabitEthernet* | 10gbase-x-sfpp |
| Loopback* | virtual |
| Vlan* | virtual |
| Port-channel* | lag |

## Status Mapping

Cisco link status maps to Nautobot status:

| Cisco Status | Nautobot Status |
|--------------|-----------------|
| up | active |
| down | failed |
| administratively down | planned |

## Usage Example

### 1. Create a Template

Create a template in Cockpit-NG UI or upload via `/api/templates`:

```jinja2
{
  "id": "{{ nautobot.id }}",
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

### 2. Execute via API

```bash
curl -X POST http://localhost:8000/api/templates/execute-and-sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": 123,
    "device_ids": ["device-uuid"],
    "output_format": "json",
    "dry_run": false
  }'
```

### 3. Monitor Progress

The endpoint returns a `task_id` and `job_id` for tracking:

```json
{
  "success": true,
  "task_id": "celery-task-uuid",
  "job_id": "123",
  "message": "Successfully queued update for 1 device(s)",
  "parsed_updates": [{ ... }]
}
```

## Notes

- **IP Address Creation**: If an IP address already exists in Nautobot, it will be reused
- **Interface Creation**: If an interface already exists with the same name, creation will fail (use unique names)
- **Primary IPv4**: Only one interface should have `is_primary_ipv4: true`; if multiple are marked, the first one wins
- **Namespaces**: Make sure the namespace exists in Nautobot before referencing it
- **Dry Run**: Set `dry_run: true` in the API call to test without making changes

## Troubleshooting

### "Namespace is required"
- Add `namespace` field to interfaces with IP addresses
- Or set a default in your template: `"namespace": "{{ namespace_id|default('Global') }}"`

### "Interface type not found"
- Use exact Nautobot interface type IDs or slugs
- Check available types in Nautobot UI under DCIM → Interface Types

### "Failed to create interface"
- Interface with that name may already exist
- Check interface name matches device's naming convention
- View errors in `job_id` results via `/api/jobs/runs/{job_id}`

## Related Endpoints

- `POST /api/templates/render` - Test template rendering without executing
- `POST /api/templates/execute-and-sync` - Execute and update devices
- `GET /api/jobs/runs/{job_id}` - Check job status and results
