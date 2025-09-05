# compare checkmk devices and nautobot devices

## general

This app compares nautobot devices and checkmk devices and shows the difference. Due to the different data structures, the data must first be normalized. After normalization, the data is compared. If the data differs, the devices can be listed and the differences corrected.

## The app works as follows

- Get a list of all devices in nautobot
- For each device get all attributes of the device
- Normalize the data structure
- Check if the device is in checkmk
- If yes: get all attributes
- Normalize the checkmk attributes
- Compare the normalized nautobot and the normalized checkmk data structure

### Getting data from nautobot

Use the endpoint /api/nautobot/devices/{device_id} to get all the attributes from nautobot. The data looks as follows:

    {
    "data": {
        "devices": [
        {
            "id": "3ec64b79-aa33-46be-b9c2-6a5aa9ea6381",
            "name": "lab-1",
            "hostname": "lab-1",
            "asset_tag": null,
            "config_context": {},
            "_custom_field_data": {
            "net": "nocheins",
            "last_backup": null,
            "snmp_credentials": "",
            "last_network_data_sync": null
            },
            "custom_field_data": {
            "net": "nocheins",
            "last_backup": null,
            "snmp_credentials": "",
            "last_network_data_sync": null
            },
            "position": null,
            "face": null,
            "serial": "131184641",
            "local_config_context_data": null,
            "primary_ip4": {
            "id": "e674dec4-5444-402b-a54c-1f0f30cfdf7b",
            "description": "",
            "ip_version": 4,
            "address": "192.168.178.100/24",
            "host": "192.168.178.100",
            "mask_length": 24,
            "dns_name": "",
            "parent": {
                "id": "38f705fa-291b-4f98-97e1-deb0d1636451",
                "prefix": "192.168.178.0/24"
            },
            "status": {
                "id": "a56c7608-d8dd-4bb2-89a4-5ac8034175d7",
                "name": "Active"
            },
            "interfaces": [
                {
                "id": "c0b34541-4702-4bd5-80b8-43c779e98c98",
                "name": "Ethernet0/0"
                }
            ]
            },
            "role": {
            "id": "00b8d2c9-e5c1-4ad7-b8e6-f37c3bde52ad",
            "name": "network"
            },
            "device_type": {
            "id": "57dbf256-de76-4e21-ba54-46347f8c546d",
            "model": "virtual",
            "manufacturer": {
                "id": "0adde07c-56f0-4046-ba6f-236b158a407d",
                "name": "Cisco"
            }
            },
            "platform": {
            "id": "8d8587b5-01ec-4ea5-ba78-12416a037348",
            "name": "virtual",
            "manufacturer": {
                "id": "0adde07c-56f0-4046-ba6f-236b158a407d",
                "name": "Cisco"
            }
            },
            "tags": [],
            "tenant": null,
            "rack": {
            "id": "5bf72537-9ad5-4e15-8df4-a20752e75823",
            "name": "rack-1",
            "rack_group": null
            },
            "location": {
            "id": "6cc93cbd-5026-4fdc-8fc0-0c9e1657e817",
            "name": "lab",
            "description": "",
            "location_type": {
                "id": "3d0ff084-9188-4f36-a9c0-3b15ea1dbbef",
                "name": "lab"
            },
            "parent": null
            },
            "status": {
            "id": "a56c7608-d8dd-4bb2-89a4-5ac8034175d7",
            "name": "Active"
            },
            "vrfs": [],
            "interfaces": [
            {
                "id": "c0b34541-4702-4bd5-80b8-43c779e98c98",
                "name": "Ethernet0/0",
                "description": "",
                "enabled": true,
                "mac_address": null,
                "type": "A_1000BASE_T",
                "mode": null,
                "mtu": null,
                "parent_interface": null,
                "bridged_interfaces": [],
                "status": {
                "id": "a56c7608-d8dd-4bb2-89a4-5ac8034175d7",
                "name": "Active"
                },
                "lag": null,
                "member_interfaces": [],
                "vrf": null,
                "ip_addresses": [
                {
                    "address": "192.168.178.100/24",
                    "status": {
                    "id": "a56c7608-d8dd-4bb2-89a4-5ac8034175d7",
                    "name": "Active"
                    },
                    "role": null,
                    "tags": [],
                    "parent": {
                    "id": "38f705fa-291b-4f98-97e1-deb0d1636451",
                    "network": "192.168.178.0",
                    "prefix": "192.168.178.0/24",
                    "prefix_length": 24,
                    "namespace": {
                        "id": "a5ee618b-f605-4727-b025-5e206892eddd",
                        "name": "Global"
                    }
                    }
                }
                ],
                "connected_circuit_termination": null,
                "tagged_vlans": [],
                "untagged_vlan": null,
                "cable": null,
                "tags": []
            }
            ],
            "parent_bay": null,
            "device_bays": []
        }
        ]
    }
    }