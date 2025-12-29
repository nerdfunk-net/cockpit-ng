# Baseline Test Data for Integration Tests

This document describes the test data available in your Nautobot instance loaded from `contributing-data/tests_baseline/baseline.yaml`.

## Test Data Summary

### Locations (Hierarchical)
- **Country A**
  - State A
    - **City A**
- **Country B**
  - State B
    - **City B**

### Roles
- **Network** - Network devices
- **server** - Server devices

### Tags
- **Production** - Production environment (green)
- **Staging** - Staging environment (yellow)

### Platforms
- **Cisco IOS** - Network platform (manufacturer: Cisco, driver: cisco_ios)
- **ServerPlatform** - Server platform (manufacturer: ServerInc)

### Manufacturers
- **NetworkInc** - Network equipment
- **ServerInc** - Server equipment

### Device Types
- **networkA** (manufacturer: NetworkInc)
- **serverA** (manufacturer: ServerInc)

---

## Network Devices (100 devices)

### City A - Production (lab-01 to lab-49)
- **Device Names**: `lab-01` through `lab-49`
- **Location**: City A
- **Role**: Network
- **Platform**: Cisco IOS
- **Device Type**: networkA
- **Tags**: Production
- **IP Range**: 192.168.178.1-49/24
- **Interfaces**: GigabitEthernet1/0/1, GigabitEthernet1/0/2
- **Custom Fields**:
  - net: netA
  - checkmk_site: siteA
  - free_textfield: "This is a network device."
  - last_backup: 2024-06-01

**Note**: lab-35 through lab-49 do NOT have custom fields (missing from baseline)

### City B - Production (lab-50 to lab-79)
- **Device Names**: `lab-50` through `lab-79`
- **Location**: City B
- **Role**: Network
- **Platform**: Cisco IOS
- **Device Type**: networkA
- **Tags**: Production
- **IP Range**: 192.168.178.50-79/24
- **Interfaces**: GigabitEthernet1/0/1, GigabitEthernet1/0/2
- **Custom Fields**: None

### City B - Staging (lab-80 to lab-100)
- **Device Names**: `lab-80` through `lab-100`
- **Location**: City B
- **Role**: Network
- **Platform**: Cisco IOS
- **Device Type**: networkA
- **Tags**: Staging
- **IP Range**: 192.168.178.80-100/24
- **Interfaces**: GigabitEthernet1/0/1, GigabitEthernet1/0/2
- **Custom Fields**: None

---

## Server Devices (20 devices)

### City A - Production (server-01 to server-09)
- **Device Names**: `server-01` through `server-09`
- **Location**: City A
- **Role**: server
- **Platform**: ServerPlatform
- **Device Type**: serverA
- **Tags**: Production
- **IP Range**: 192.168.180.1-9/24
- **Interfaces**: eth0
- **Custom Fields**: None

### City B - Production (server-10)
- **Device Name**: `server-10`
- **Location**: City B
- **Role**: server
- **Platform**: ServerPlatform
- **Device Type**: serverA
- **Tags**: Production
- **IP**: 192.168.180.10/24
- **Interface**: eth0

### City B - Staging (server-11 to server-20)
- **Device Names**: `server-11` through `server-20`
- **Location**: City B
- **Role**: server
- **Platform**: ServerPlatform
- **Device Type**: serverA
- **Tags**: Staging
- **IP Range**: 192.168.180.11-20/24
- **Interfaces**: eth0
- **Custom Fields**: None

---

## Test Scenarios

### Filter by Location

**City A**:
- 49 network devices (lab-01 to lab-49)
- 9 server devices (server-01 to server-09)
- **Total**: 58 devices

**City B**:
- 51 network devices (lab-50 to lab-100)
- 11 server devices (server-10 to server-20)
- **Total**: 62 devices

### Filter by Role

**Network role**:
- 100 network devices (all lab-XX devices)

**server role**:
- 20 server devices (all server-XX devices)

### Filter by Tag

**Production**:
- 79 devices (lab-01 to lab-79 + server-01 to server-10)

**Staging**:
- 41 devices (lab-80 to lab-100 + server-11 to server-20)

### Filter by Platform

**Cisco IOS**:
- 100 devices (all lab-XX devices)

**ServerPlatform**:
- 20 devices (all server-XX devices)

### Combined Filters (Logical Operations)

**City A AND Network role**:
- 49 devices (lab-01 to lab-49)

**City A AND server role**:
- 9 devices (server-01 to server-09)

**City B AND Production tag**:
- 30 devices (lab-50 to lab-79 + server-10)

**City B AND Staging tag**:
- 31 devices (lab-80 to lab-100 + server-11 to server-20)

**Network role AND Production tag**:
- 79 devices (lab-01 to lab-79)

**Network role AND Staging tag**:
- 21 devices (lab-80 to lab-100)

**City A OR City B**:
- 120 devices (all devices)

**Production OR Staging**:
- 120 devices (all devices)

---

## IP Address Ranges

- **192.168.178.0/24** - LAB Network A (network devices)
- **192.168.179.0/24** - LAB Network B (secondary IPs for network devices)
- **192.168.180.0/24** - LAB Server A (server devices)

---

## Custom Fields

### Available Custom Fields
- **net** (select): netA, netB, serverA
- **checkmk_site** (select): siteA, siteB
- **free_textfield** (text): Free text
- **last_backup** (date): Last backup date
- **snmp_credentials** (select): credA, credB

### Devices with Custom Fields
Only **lab-01 through lab-34** have custom fields populated:
- net: netA
- checkmk_site: siteA
- free_textfield: "This is a network device."
- last_backup: 2024-06-01

All other devices have NO custom fields set.

---

## Expected Test Results

### Test: Filter by location "City A"
**Expected**: 58 devices (49 network + 9 servers)

### Test: Filter by location "City B"
**Expected**: 62 devices (51 network + 11 servers)

### Test: Filter by role "Network"
**Expected**: 100 devices (all lab-XX)

### Test: Filter by role "server"
**Expected**: 20 devices (all server-XX)

### Test: Filter by tag "Production"
**Expected**: 79 devices

### Test: Filter by tag "Staging"
**Expected**: 41 devices

### Test: Filter by platform "Cisco IOS"
**Expected**: 100 devices

### Test: Filter by name contains "lab"
**Expected**: 100 devices (lab-01 to lab-100)

### Test: Filter by name contains "server"
**Expected**: 20 devices (server-01 to server-20)

### Test: Filter location="City A" AND role="Network"
**Expected**: 49 devices (lab-01 to lab-49)

### Test: Filter location="City A" AND role="server"
**Expected**: 9 devices (server-01 to server-09)

### Test: Filter location="City B" AND tag="Production"
**Expected**: 30 devices (lab-50 to lab-79 + server-10)

### Test: Filter location="City B" AND tag="Staging"
**Expected**: 31 devices (lab-80 to lab-100 + server-11 to server-20)

### Test: Filter location="City A" OR location="City B"
**Expected**: 120 devices (all devices)

### Test: Filter tag="Production" OR tag="Staging"
**Expected**: 120 devices (all devices)

### Test: Filter with has_primary_ip=true
**Expected**: 120 devices (all have primary_ip4)

### Test: Filter with has_primary_ip=false
**Expected**: 0 devices (all devices have primary IPs)

---

## Notes for Test Developers

1. **All devices have primary IPs** - `has_primary_ip` filter will always return all devices
2. **Custom fields are sparse** - Only 34 devices (lab-01 to lab-34) have custom fields
3. **Hierarchical locations** - Use "City A" or "City B" for location filters (not "Country A")
4. **Case-sensitive** - Role is "Network" (capital N), not "network"
5. **Tag capitalization** - "Production" and "Staging" (capital first letter)
6. **Platform exact match** - "Cisco IOS" (with space), not "cisco_ios"

---

## Loading Baseline Data

If baseline data is not loaded in your test Nautobot:

```bash
# From cockpit-ng root directory
cd backend

# Use the baseline import tool (if available)
python scripts/import_baseline.py ../contributing-data/tests_baseline/baseline.yaml

# Or use the UI
# Navigate to Tools → Import Baseline
# Upload: contributing-data/tests_baseline/baseline.yaml
```
