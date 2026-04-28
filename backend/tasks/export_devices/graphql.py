from typing import List


def build_graphql_query(properties: List[str]) -> str:
    """
    Build GraphQL query based on requested properties.

    Fetches all device data but EXCLUDES UUIDs (id fields) since they are
    instance-specific and not portable between Nautobot instances.
    """
    return """
    query Devices($id_filter: [String])
    {
      devices(id: $id_filter)
      {
        name
        asset_tag
        config_context
        _custom_field_data
        position
        face
        serial
        local_config_context_data
        primary_ip4
        {
          description
          ip_version
          address
          host
          mask_length
          dns_name
          parent {
            prefix
            namespace {
              name
            }
          }
          status {
            name
          }
          interfaces {
            name
          }
        }
        role {
          name
        }
        device_type
        {
          model
          manufacturer
          {
            name
          }
        }
        platform
        {
          name
          manufacturer {
            name
          }
        }
        tags
        {
          name
          content_types {
            app_label
            model
          }
        }
        tenant
        {
            name
            tenant_group {
              name
            }
        }
        rack
        {
          name
          rack_group
          {
            name
          }
        }
        location
        {
          name
          description
          location_type
          {
            name
          }
          parent
          {
            name
            description
            location_type
            {
              name
            }
          }
        }
        status
        {
          name
        }
        vrfs
        {
          name
          namespace
          {
            name
          }
          rd
          description
        }
        interfaces
        {
          name
          description
          enabled
          mac_address
          type
          mode
          mtu
          parent_interface
          {
            name
          }
          bridged_interfaces
          {
            name
          }
          status {
            name
          }
          lag {
            name
            enabled
          }
          member_interfaces {
            name
          }
          vrf
          {
            name
            namespace
            {
              name
            }
          }
          ip_addresses {
            address
            status {
              name
            }
            role
            {
              name
            }
            tags {
              name
            }
            parent {
              network
              prefix
              prefix_length
              namespace {
                name
              }
            }
          }
          connected_circuit_termination
          {
            circuit
            {
              cid
              commit_rate
              provider
              {
                name
              }
            }
          }
          tagged_vlans
          {
            name
            vid
          }
          untagged_vlan
          {
            name
            vid
          }
          cable
          {
            termination_a_type
            status
            {
              name
            }
            color
          }
          tags
          {
            name
            content_types
            {
              app_label
              model
            }
          }
        }
        parent_bay
        {
          name
        }
        device_bays
        {
          name
        }
      }
    }
    """
