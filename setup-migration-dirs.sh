#!/bin/bash
# setup-migration-dirs.sh - Create new directory structure for migration
# Run this ONCE before starting migration

set -e

cd /Users/mp/programming/cockpit-ng/frontend/src/components

echo "Creating new directory structure..."

# Layout
mkdir -p layout

# Features
mkdir -p features

# Nautobot
mkdir -p features/nautobot/{add-device,onboard,offboard,sync-devices,export}
mkdir -p features/nautobot/tools/{bulk-edit,check-ip}

# CheckMK
mkdir -p features/checkmk/{sync-devices,live-update,hosts-inventory}

# Network
mkdir -p features/network/configs/{view,backup,compare}
mkdir -p features/network/automation/{netmiko,ansible-inventory,templates}
mkdir -p features/network/compliance
mkdir -p features/network/tools/ping

# Jobs
mkdir -p features/jobs/{templates,scheduler,view}

# Settings
mkdir -p features/settings/{common,connections,compliance,templates,git,cache,celery,credentials,permissions}
mkdir -p features/settings/connections/{nautobot,checkmk,grafana}

# Profile
mkdir -p features/profile

echo "✓ Directory structure created!"
echo ""
echo "Created directories:"
find features layout -type d | sort
echo ""
echo "Ready for migration!"
