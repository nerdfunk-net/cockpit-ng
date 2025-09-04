#!/usr/bin/env python3
"""
CheckMK API Client - Usage Examples

This file demonstrates various usage patterns for the CheckMK API client.
"""

import sys
import logging
from checkmk.client import CheckMKClient, CheckMKAPIError

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def basic_usage_example():
    """Basic usage example - connection and host operations"""
    print("=== Basic Usage Example ===")
    
    # Initialize client with your CheckMK server details
    client = CheckMKClient(
        host="192.168.178.101:8080",
        site_name="cmk",
        username="automation", 
        password="automation",
        protocol="http"
    )
    
    try:
        # Test connection
        logger.info("Testing connection...")
        if client.test_connection():
            logger.info("✓ Successfully connected to CheckMK API")
        else:
            logger.error("✗ Failed to connect to CheckMK API")
            return False
            
        # Get CheckMK version
        version = client.get_version()
        logger.info(f"CheckMK version: {version}")
        
        # Get all hosts
        hosts = client.get_all_hosts()
        logger.info(f"Found {len(hosts.get('value', []))} hosts")
        
        # Show first few hosts
        for host in hosts.get('value', [])[:3]:
            host_name = host.get('id')
            host_attrs = host.get('extensions', {}).get('attributes', {})
            ip_address = host_attrs.get('ipaddress', 'N/A')
            logger.info(f"  - {host_name}: {ip_address}")
            
        return True
        
    except CheckMKAPIError as e:
        logger.error(f"API Error: {e}")
        return False

def host_management_example():
    """Example of host management operations"""
    print("\n=== Host Management Example ===")
    
    client = CheckMKClient(
        host="192.168.178.101:8080",
        site_name="cmk",
        username="automation",
        password="automation",
        protocol="http"
    )
    
    test_hostname = "api-test-server"
    
    try:
        # Add a new host
        logger.info(f"Adding new host: {test_hostname}")
        new_host = client.create_host(
            hostname=test_hostname,
            folder="/",
            attributes={
                "ipaddress": "192.168.1.200",
                "alias": "API Test Server",
                "site": "cmk"
            }
        )
        logger.info(f"✓ Host added successfully: {new_host.get('id')}")
        
        # Get the specific host
        logger.info(f"Retrieving host: {test_hostname}")
        host_info = client.get_host(test_hostname)
        logger.info(f"✓ Host retrieved: {host_info.get('id')}")
        
        # Update the host
        logger.info(f"Updating host: {test_hostname}")
        updated_host = client.update_host(
            hostname=test_hostname,
            attributes={
                "ipaddress": "192.168.1.201",
                "alias": "Updated API Test Server"
            }
        )
        logger.info(f"✓ Host updated successfully")
        
        # Check pending changes
        pending = client.get_pending_changes()
        change_count = len(pending.get('value', []))
        logger.info(f"Pending changes: {change_count}")
        
        if change_count > 0:
            # Activate changes
            logger.info("Activating pending changes...")
            activation = client.activate_changes()
            if activation.get('redirected'):
                logger.info(f"✓ Changes activated (redirected to: {activation.get('location')})")
            else:
                logger.info("✓ Changes activated successfully")
        
        # Clean up - delete the test host
        logger.info(f"Cleaning up - deleting test host: {test_hostname}")
        client.delete_host(test_hostname)
        logger.info("✓ Test host deleted")
        
        # Activate cleanup changes
        client.activate_changes()
        logger.info("✓ Cleanup changes activated")
        
    except CheckMKAPIError as e:
        logger.error(f"Host management error: {e}")
        if e.response_data:
            logger.error(f"Response details: {e.response_data}")

def service_monitoring_example():
    """Example of service and monitoring operations"""
    print("\n=== Service Monitoring Example ===")
    
    client = CheckMKClient(
        host="192.168.178.101:8080", 
        site_name="cmk",
        username="automation",
        password="automation",
        protocol="http"
    )
    
    try:
        # Get all monitored hosts with status
        monitored_hosts = client.get_all_monitored_hosts(
            columns=['name', 'state', 'address', 'alias']
        )
        
        if not monitored_hosts.get('value'):
            logger.warning("No monitored hosts found for service monitoring example")
            return
            
        # Use the first host for demo
        first_host_data = monitored_hosts['value'][0]
        hostname = first_host_data.get('extensions', {}).get('name')
        logger.info(f"Using host for service demo: {hostname}")
        
        # Try to get services for this host
        try:
            services = client.get_host_services(hostname, columns=['description', 'state'])
            service_count = len(services.get('value', []))
            logger.info(f"Found {service_count} services on {hostname}")
            
            # Show first few services
            for service in services.get('value', [])[:3]:
                service_data = service.get('extensions', {})
                service_desc = service_data.get('description')
                state = service_data.get('state', 0)
                state_text = {0: 'OK', 1: 'WARNING', 2: 'CRITICAL', 3: 'UNKNOWN'}.get(state, f'State {state}')
                logger.info(f"  - Service: {service_desc} - {state_text}")
                
        except CheckMKAPIError as e:
            logger.info(f"Services not available for {hostname}: {e}")
            
        # Try service discovery
        try:
            logger.info(f"Running service discovery on {hostname}")
            discovery = client.start_service_discovery(hostname, mode="new")
            logger.info(f"✓ Service discovery started")
            
        except CheckMKAPIError as e:
            logger.info(f"Service discovery not available: {e}")
            
    except CheckMKAPIError as e:
        logger.error(f"Service monitoring error: {e}")

def bulk_operations_example():
    """Example of bulk operations"""
    print("\n=== Bulk Operations Example ===")
    
    client = CheckMKClient(
        host="192.168.178.101:8080",
        site_name="cmk", 
        username="automation",
        password="automation",
        protocol="http"
    )
    
    # Define bulk host creation
    hosts_to_create = [
        {
            'host_name': 'bulk-test-1',
            'folder': '/',
            'attributes': {
                'ipaddress': '192.168.1.101',
                'alias': 'Bulk Test Server 1'
            }
        },
        {
            'host_name': 'bulk-test-2',
            'folder': '/',
            'attributes': {
                'ipaddress': '192.168.1.102',
                'alias': 'Bulk Test Server 2'
            }
        }
    ]
    
    try:
        # Execute bulk host creation
        logger.info("Executing bulk host creation...")
        result = client.bulk_create_hosts(hosts_to_create)
        logger.info("✓ Bulk host creation completed")
        
        # Activate changes
        client.activate_changes()
        logger.info("✓ Bulk changes activated")
        
        # Cleanup - delete test hosts
        logger.info("Cleaning up bulk test hosts...")
        hostnames_to_delete = ['bulk-test-1', 'bulk-test-2']
        
        try:
            client.bulk_delete_hosts(hostnames_to_delete)
            logger.info("✓ Bulk deletion completed")
        except CheckMKAPIError:
            # Fallback to individual deletion
            for hostname in hostnames_to_delete:
                try:
                    client.delete_host(hostname)
                    logger.info(f"✓ Deleted {hostname}")
                except CheckMKAPIError:
                    logger.info(f"Host {hostname} already deleted or not found")
                
        # Activate cleanup
        client.activate_changes()
        logger.info("✓ Cleanup completed")
        
    except CheckMKAPIError as e:
        logger.error(f"Bulk operations error: {e}")

def host_groups_example():
    """Example of host group management"""
    print("\n=== Host Groups Example ===")
    
    client = CheckMKClient(
        host="192.168.178.101:8080",
        site_name="cmk",
        username="automation", 
        password="automation",
        protocol="http"
    )
    
    try:
        # Get all host groups
        groups = client.get_host_groups()
        logger.info(f"Found {len(groups.get('value', []))} host groups")
        
        # Show existing groups
        for group in groups.get('value', [])[:5]:
            group_id = group.get('id')
            extensions = group.get('extensions', {})
            alias = extensions.get('alias', 'No alias')
            logger.info(f"  - Group: {group_id} ({alias})")
        
        # Try to create a test group
        test_group_name = "api_test_group"
        logger.info(f"Creating test group: {test_group_name}")
        
        try:
            new_group = client.create_host_group(
                name=test_group_name,
                alias="API Test Group"
            )
            logger.info(f"✓ Group created: {new_group.get('id')}")
            
            # Activate changes
            client.activate_changes()
            logger.info("✓ Group creation activated")
            
        except CheckMKAPIError as e:
            logger.info(f"Group creation failed (may already exist): {e}")
            
    except CheckMKAPIError as e:
        logger.error(f"Host groups error: {e}")

def main():
    """Run all examples"""
    print("CheckMK API Client Examples")
    print("=" * 40)
    
    # Run examples in order
    examples = [
        basic_usage_example,
        host_management_example, 
        service_monitoring_example,
        bulk_operations_example,
        host_groups_example
    ]
    
    for example_func in examples:
        try:
            example_func()
        except Exception as e:
            logger.error(f"Example {example_func.__name__} failed: {e}")
        
        print()  # Add spacing between examples

if __name__ == "__main__":
    main()