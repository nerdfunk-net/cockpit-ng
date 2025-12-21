# Well-Known SNMP OIDs for Cisco Devices

This document lists commonly used SNMP Object Identifiers (OIDs) for monitoring and managing Cisco network devices. These are based on standard RFC MIBs and Cisco's enterprise-specific MIBs (under the Cisco enterprise OID tree 1.3.6.1.4.1.9).

## Standard MIB OIDs (RFC-compliant, applicable to most devices including Cisco)

### System Information
- **sysDescr** (1.3.6.1.2.1.1.1): Device description.
- **sysUpTime** (1.3.6.1.2.1.1.3): System uptime.
- **sysName** (1.3.6.1.2.1.1.5): System name (host name).
- **sysLocation** (1.3.6.1.2.1.1.6): Physical location of the device.
- **sysContact** (1.3.6.1.2.1.1.4): Contact information for the device.

### Interfaces
- **ifTable** (1.3.6.1.2.1.2.2): Interface table (e.g., ifDescr.1 for interface 1).
- **ifOperStatus** (1.3.6.1.2.1.2.2.1.8): Interface operational status.
- **ifAdminStatus** (1.3.6.1.2.1.2.2.1.7): Interface administrative status.
- **ifSpeed** (1.3.6.1.2.1.2.2.1.5): Interface speed in bits per second.
- **ifInOctets** (1.3.6.1.2.1.2.2.1.10): Total input octets (bytes received).
- **ifOutOctets** (1.3.6.1.2.1.2.2.1.16): Total output octets (bytes sent).
- **ifInErrors** (1.3.6.1.2.1.2.2.1.14): Number of input errors.
- **ifOutErrors** (1.3.6.1.2.1.2.2.1.20): Number of output errors.
- **ifInDiscards** (1.3.6.1.2.1.2.2.1.13): Number of input packets discarded.
- **ifOutDiscards** (1.3.6.1.2.1.2.2.1.19): Number of output packets discarded.

#### 64-Bit Interface Statistics (High-Capacity Counters)
Use these for high-speed interfaces to avoid 32-bit counter rollover.
- **ifHCInOctets** (1.3.6.1.2.1.31.1.1.1.6): High-capacity input octets (64-bit).
- **ifHCOutOctets** (1.3.6.1.2.1.31.1.1.1.10): High-capacity output octets (64-bit).
- **ifHCInUcastPkts** (1.3.6.1.2.1.31.1.1.1.7): High-capacity input unicast packets (64-bit).
- **ifHCOutUcastPkts** (1.3.6.1.2.1.31.1.1.1.11): High-capacity output unicast packets (64-bit).
- **ifHCInMulticastPkts** (1.3.6.1.2.1.31.1.1.1.8): High-capacity input multicast packets (64-bit).
- **ifHCOutMulticastPkts** (1.3.6.1.2.1.31.1.1.1.12): High-capacity output multicast packets (64-bit).
- **ifHCInBroadcastPkts** (1.3.6.1.2.1.31.1.1.1.9): High-capacity input broadcast packets (64-bit).
- **ifHCOutBroadcastPkts** (1.3.6.1.2.1.31.1.1.1.13): High-capacity output broadcast packets (64-bit).

### IP Addresses
- **ipAdEntAddr** (1.3.6.1.2.1.4.20.1.1): IP address table.

### Routing

#### Static Routes
- **ipCidrRouteTable** (1.3.6.1.2.1.4.24.4): CIDR route table (includes static routes).
- **ipCidrRouteDest** (1.3.6.1.2.1.4.24.4.1.1): Route destination.
- **ipCidrRouteMask** (1.3.6.1.2.1.4.24.4.1.2): Route mask.
- **ipCidrRouteNextHop** (1.3.6.1.2.1.4.24.4.1.4): Route next hop.

#### OSPF (SPF)
- **ospfAreaTable** (1.3.6.1.2.1.14.2): OSPF area table.
- **ospfIfTable** (1.3.6.1.2.1.14.7): OSPF interface table.
- **ospfNeighborTable** (1.3.6.1.2.1.14.10): OSPF neighbor table.
- **ospfVirtNeighborTable** (1.3.6.1.2.1.14.11): OSPF virtual neighbor table.

#### BGP
- **bgpPeerTable** (1.3.6.1.2.1.15.3): BGP peer table.
- **bgpPeerState** (1.3.6.1.2.1.15.3.1.2): BGP peer state.
- **bgpPeerRemoteAddr** (1.3.6.1.2.1.15.3.1.7): BGP peer remote address.
- **bgpPeerLocalAddr** (1.3.6.1.2.1.15.3.1.8): BGP peer local address.

## Cisco-Specific OIDs (Under 1.3.6.1.4.1.9)

### CPU Utilization
- **cpmCPUTotal5sec** (1.3.6.1.4.1.9.9.109.1.1.1.1.3): CPU usage over 5 seconds.
- **cpmCPUTotal1min** (1.3.6.1.4.1.9.9.109.1.1.1.1.4): CPU usage over 1 minute.
- **cpmCPUTotal5min** (1.3.6.1.4.1.9.9.109.1.1.1.1.5): CPU usage over 5 minutes.

### Memory
- **ciscoMemoryPoolUsed** (1.3.6.1.4.1.9.9.48.1.1.1.5): Used memory pool.
- **ciscoMemoryPoolFree** (1.3.6.1.4.1.9.9.48.1.1.1.6): Free memory pool.
- **ciscoMemoryPoolLargestFree** (1.3.6.1.4.1.9.9.48.1.1.1.7): Largest free memory block.
- **ciscoMemoryPoolLowestFree** (1.3.6.1.4.1.9.9.48.1.1.1.8): Lowest free memory.

### Storage
- **ciscoFlashDeviceTable** (1.3.6.1.4.1.9.9.10.1.1.3): Flash device table.
- **ciscoFlashDeviceSize** (1.3.6.1.4.1.9.9.10.1.1.3.1.4): Flash device size.
- **ciscoFlashDeviceFreeSpace** (1.3.6.1.4.1.9.9.10.1.1.3.1.5): Flash device free space.

### Power and Fans
- **ciscoEnvMonSupplyStatusTable** (1.3.6.1.4.1.9.9.13.1.2.1): Power supply status table.
- **ciscoEnvMonSupplyState** (1.3.6.1.4.1.9.9.13.1.2.1.1.3): Power supply state.
- **ciscoEnvMonFanStatusTable** (1.3.6.1.4.1.9.9.13.1.4.1): Fan status table.
- **ciscoEnvMonFanState** (1.3.6.1.4.1.9.9.13.1.4.1.1.3): Fan state.

### Interfaces (Cisco-specific)
- **locIfDescr** (1.3.6.1.4.1.9.2.2.1.1.28): Local interface description.
- **ifAlias** (1.3.6.1.2.1.31.1.1.1.18): Interface alias (description).

### Environment (Temperature, etc.)
- **entSensorValue** (1.3.6.1.4.1.9.9.91.1.1.1.1.4): Sensor values (e.g., temperature).

### Device Model/Software
- **entPhysicalModelName** (1.3.6.1.2.1.47.1.1.1.1.13): Hardware model.
- **ciscoImageString** (1.3.6.1.4.1.9.2.1.73): IOS image version.

## Notes
- For a complete list, refer to Cisco's MIB documentation available on their website.
- Use SNMP walk tools to discover additional OIDs specific to your device model.
- In Cockpit-NG, SNMP mappings can be customized in `/config/snmp_mapping.yaml` for device normalization.
- Ensure SNMP is enabled and configured on the Cisco device before querying.
