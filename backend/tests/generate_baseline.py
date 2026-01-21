#!/usr/bin/env python3
"""
Generate baseline.yaml with 100 network devices and 20 servers
Randomly distributed across City A, B, C with varied tags and custom fields
"""

import random
import yaml

# Set seed for reproducibility
random.seed(42)

baseline = {
    "location_types": [
        {"name": "Country", "description": "Country", "content_types": "dcim.device"},
        {
            "name": "State",
            "parent": "Country",
            "description": "State",
            "content_types": "dcim.device",
        },
        {
            "name": "City",
            "parent": "State",
            "description": "City",
            "content_types": "dcim.device",
        },
    ],
    "location": [
        # Country A hierarchy
        {
            "location_types": "Country",
            "parent": None,
            "name": "Country A",
            "status": "active",
            "description": "Country A",
        },
        {
            "parent": "Country A",
            "location_types": "State",
            "name": "State A",
            "description": "State A",
            "status": "active",
        },
        {
            "parent": "State A",
            "location_types": "City",
            "name": "City A",
            "description": "City A",
            "status": "active",
        },
        {
            "parent": "State A",
            "location_types": "City",
            "name": "Another City A",
            "description": "Another City A",
            "status": "active",
        },
        # Country B hierarchy
        {
            "location_types": "Country",
            "parent": None,
            "name": "Country B",
            "status": "active",
            "description": "Country B",
        },
        {
            "parent": "Country B",
            "location_types": "State",
            "name": "State B",
            "description": "State B",
            "status": "active",
        },
        {
            "parent": "State B",
            "location_types": "City",
            "name": "City B",
            "description": "City B",
            "status": "active",
        },
        {
            "parent": "State B",
            "location_types": "City",
            "name": "Another City B",
            "description": "Another City B",
            "status": "active",
        },
        # Country C hierarchy
        {
            "location_types": "Country",
            "parent": None,
            "name": "Country C",
            "status": "active",
            "description": "Country C",
        },
        {
            "parent": "Country C",
            "location_types": "State",
            "name": "State C",
            "description": "State C",
            "status": "active",
        },
        {
            "parent": "State C",
            "location_types": "City",
            "name": "City C",
            "description": "City C",
            "status": "active",
        },
        {
            "parent": "State C",
            "location_types": "City",
            "name": "Another City C",
            "description": "Another City C",
            "status": "active",
        },
    ],
    "roles": [
        {
            "name": "Network",
            "description": "This device is a network device",
            "content_types": ["dcim.device"],
        },
        {
            "name": "server",
            "description": "This device is a server",
            "content_types": ["dcim.device"],
        },
        {
            "name": "lab",
            "description": "This is a lab device",
            "content_types": ["dcim.device"],
        },
    ],
    "tags": [
        {
            "name": "Production",
            "description": "Production environment",
            "color": "green",
            "content_types": ["dcim.device"],
        },
        {
            "name": "Staging",
            "description": "Staging environment",
            "color": "yellow",
            "content_types": ["dcim.device"],
        },
        {
            "name": "lab",
            "description": "Lab environment",
            "color": "blue",
            "content_types": ["dcim.device"],
        },
    ],
    "manufacturers": [
        {"name": "NetworkInc", "description": "Network Incorporated"},
        {"name": "ServerInc", "description": "Server Incorporated"},
    ],
    "device_types": [
        {"manufacturer": "NetworkInc", "model": "networkA"},
        {"manufacturer": "ServerInc", "model": "serverA"},
    ],
    "platforms": [
        {"name": "Cisco IOS", "manufacturer": "Cisco", "network_driver": "cisco_ios"},
        {"name": "ServerPlatform", "manufacturer": "ServerInc"},
    ],
    "prefixes": [
        {"prefix": "192.168.178.0/24", "description": "Network A"},
        {"prefix": "192.168.179.0/24", "description": "Network B"},
        {"prefix": "192.168.180.0/24", "description": "Server Network"},
        {"prefix": "192.168.181.0/24", "description": "LAB Network"},
    ],
    "custom_field_choices": {
        "net": [
            {"value": "netA", "label": "Network A"},
            {"value": "netB", "label": "Network B"},
            {"value": "lab", "label": "lab"},
        ],
        "checkmk_site": [
            {"value": "siteA", "label": "Site A"},
            {"value": "siteB", "label": "Site B"},
            {"value": "siteC", "label": "Site C"},
        ],
        "snmp_credentials": [
            {"value": "credA", "label": "Credential A"},
            {"value": "credB", "label": "Credential B"},
            {"value": "credC", "label": "Credential C"},
        ],
    },
    "custom_fields": {
        "net": [
            {
                "label": "net",
                "type": "select",
                "selection_type": "single",
                "selections": ["netA", "netB", "netC"],
                "description": "Network assignment",
                "content_types": ["dcim.device"],
            }
        ],
        "checkmk_site": [
            {
                "label": "checkmk_site",
                "type": "select",
                "selection_type": "single",
                "selections": ["siteA", "siteB", "siteC"],
                "description": "CheckMK Site Name",
                "content_types": ["dcim.device"],
            }
        ],
        "free_textfield": [
            {
                "label": "free_textfield",
                "type": "text",
                "description": "A free text field for devices",
                "content_types": ["dcim.device"],
            }
        ],
        "last_backup": [
            {
                "label": "last_backup",
                "type": "date",
                "description": "Date of the last backup",
                "content_types": ["dcim.device"],
            }
        ],
        "snmp_credentials": [
            {
                "label": "snmp_credentials",
                "type": "select",
                "selection_type": "single",
                "selections": ["credA", "credB", "credC"],
                "description": "SNMP Credentials",
                "content_types": ["dcim.device"],
            }
        ],
    },
    "devices": [],
}

# Generate 100 network devices
cities = [
    "City A",
    "Another City A",
    "City B",
    "Another City B",
    "City C",
    "Another City C",
]
tags = ["Production", "Staging", "lab"]
net_values = ["netA", "netB", "lab"]
sites = ["siteA", "siteB", "siteC"]
creds = ["credA", "credB", "credC"]
dates = [
    "2025-01-15",
    "2025-02-20",
    "2025-03-10",
    "2025-04-05",
    "2025-05-12",
    "2025-06-01",
]
statuses = ["Active", "Offline"]

print("Generating 100 network devices...")
for i in range(1, 101):
    location = random.choice(cities)
    tag = random.choice(tags)
    net = random.choice(net_values)
    site = random.choice(sites)
    cred = random.choice(creds)
    backup_date = random.choice(dates)
    status = random.choice(statuses)

    # Random IP addresses
    ip_base = random.randint(1, 253)

    device = {
        "name": f"lab-{i:03d}",
        "device_type": "networkA",
        "platform": "Cisco IOS",
        "roles": ["Network"],
        "location": location,
        "status": status,
        "tags": [tag],
        "serial": f"NET{i:07d}",
        "primary_ip4": f"192.168.178.{ip_base}/24",
        "interfaces": [
            {
                "name": "GigabitEthernet1/0/1",
                "type": "1000base-t",
                "ip_address": f"192.168.178.{ip_base}/24",
            },
            {
                "name": "GigabitEthernet1/0/2",
                "type": "1000base-t",
                "ip_address": f"192.168.179.{ip_base}/24",
            },
        ],
        "custom_fields": {
            "net": net,
            "checkmk_site": site,
            "free_textfield": f"Network device in {location}",
            "last_backup": backup_date,
            "snmp_credentials": cred,
        },
    }

    baseline["devices"].append(device)

# Generate 20 server devices
print("Generating 20 server devices...")
for i in range(1, 21):
    location = random.choice(cities)
    tag = random.choice(tags)
    net = random.choice(net_values)
    site = random.choice(sites)
    backup_date = random.choice(dates)
    status = random.choice(statuses)

    # Server IPs in different subnet
    ip_num = i

    device = {
        "name": f"server-{i:02d}",
        "device_type": "serverA",
        "platform": "ServerPlatform",
        "roles": ["server"],
        "location": location,
        "status": status,
        "tags": [tag],
        "serial": f"SRV{i:07d}",
        "primary_ip4": f"192.168.180.{ip_num}/24",
        "interfaces": [
            {
                "name": "eth0",
                "type": "1000base-t",
                "ip_address": f"192.168.180.{ip_num}/24",
            }
        ],
        "custom_fields": {
            "net": net,
            "checkmk_site": site,
            "free_textfield": f"Server in {location}",
            "last_backup": backup_date,
        },
    }

    baseline["devices"].append(device)

# Write to file with blank lines between sections
output_file = "/Users/mp/programming/cockpit-ng/backend/tests/baseline.yaml"
print(f"Writing to {output_file}...")


# Custom YAML dumper to add blank lines between major sections
class BlankLineDumper(yaml.Dumper):
    pass


def write_yaml_with_blank_lines(data, file, stats):
    """Write YAML with blank lines between major sections and devices"""
    lines = []

    # Write statistics header as YAML comments
    lines.append("# Baseline Test Data Statistics")
    lines.append("# ==============================")
    lines.append(f"# Total Devices: {stats['total_devices']}")
    lines.append(f"#   - Network Devices: {stats['network_devices']}")
    lines.append(f"#   - Server Devices: {stats['server_devices']}")
    lines.append("#")
    lines.append("# Distribution by Location:")
    for loc, count in sorted(stats["locations"].items()):
        lines.append(f"#   - {loc}: {count} devices")
    lines.append("#")
    lines.append("# Distribution by Status:")
    for status, count in sorted(stats["statuses"].items()):
        lines.append(f"#   - {status}: {count} devices")
    lines.append("#")
    lines.append("# Distribution by Tag:")
    for tag, count in sorted(stats["tags"].items()):
        lines.append(f"#   - {tag}: {count} devices")
    lines.append("#")
    lines.append("")  # Blank line after header

    # Write each top-level section
    for key in data.keys():
        if key == "devices":
            # Handle devices separately to add blank lines between them
            lines.append("devices:")
            for i, device in enumerate(data[key]):
                # Add blank line before each device (except first)
                if i > 0:
                    lines.append("")
                # Dump the device
                device_yaml = yaml.dump(
                    [device],
                    default_flow_style=False,
                    sort_keys=False,
                    allow_unicode=True,
                )
                # Remove the leading '- ' and adjust indentation
                device_lines = device_yaml.strip().split("\n")
                for j, line in enumerate(device_lines):
                    if j == 0:
                        lines.append("- " + line[2:])  # First line with '-'
                    else:
                        lines.append(line)  # Keep original indentation from yaml.dump
        else:
            # For other sections, add blank line before section
            if lines:  # Add blank line before section (except first)
                lines.append("")
            section_yaml = yaml.dump(
                {key: data[key]},
                default_flow_style=False,
                sort_keys=False,
                allow_unicode=True,
            )
            lines.extend(section_yaml.rstrip().split("\n"))

    file.write("\n".join(lines) + "\n")


# Count distribution statistics
location_counts = {}
tag_counts = {}
status_counts = {}
network_device_count = 0
server_device_count = 0

for device in baseline["devices"]:
    # Count by location
    loc = device["location"]
    location_counts[loc] = location_counts.get(loc, 0) + 1

    # Count by tag
    tag = device["tags"][0]
    tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # Count by status
    status = device["status"]
    status_counts[status] = status_counts.get(status, 0) + 1

    # Count by device type
    if "Network" in device["roles"]:
        network_device_count += 1
    elif "server" in device["roles"]:
        server_device_count += 1

# Prepare statistics dictionary
stats = {
    "total_devices": len(baseline["devices"]),
    "network_devices": network_device_count,
    "server_devices": server_device_count,
    "locations": location_counts,
    "tags": tag_counts,
    "statuses": status_counts,
}

# Write YAML file with statistics
with open(output_file, "w") as f:
    write_yaml_with_blank_lines(baseline, f, stats)

print("✓ Generated baseline.yaml with:")
print(f"  - {network_device_count} network devices (lab-001 to lab-100)")
print(f"  - {server_device_count} server devices (server-01 to server-20)")
print(f"  - Randomly distributed across: {', '.join(cities)}")
print(f"  - Random tags: {', '.join(tags)}")
print("  - Random custom fields for testing logical expressions")
print("\nDistribution summary:")

print("\nBy Location:")
for loc, count in sorted(location_counts.items()):
    print(f"  {loc}: {count} devices")

print("\nBy Tag:")
for tag, count in sorted(tag_counts.items()):
    print(f"  {tag}: {count} devices")

print("\nBy Status:")
for status, count in sorted(status_counts.items()):
    print(f"  {status}: {count} devices")
