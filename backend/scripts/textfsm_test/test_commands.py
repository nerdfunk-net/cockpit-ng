#!/usr/bin/env python3
"""
TextFSM test script — verify parsed output of ARP and MAC address table commands.

Run this against a real device BEFORE finalising the executor so you can confirm
the exact field names that ntc-templates produces for your platform.

Usage:
    cd backend/
    python scripts/textfsm_test/test_commands.py --host 192.168.1.1 -u admin -p secret
    python scripts/textfsm_test/test_commands.py --host 192.168.1.1 -u admin -p secret --platform cisco_ios

Required packages (already installed via backend requirements):
    netmiko

Expected output structure for cisco_ios:
    show ip arp:
        [{'protocol': 'Internet', 'address': '10.0.0.1', 'age': '0',
          'mac': 'aabb.cc00.0100', 'type': 'ARPA', 'interface': 'Vlan10'}, ...]

    show mac address-table:
        [{'destination_address': 'aabb.cc00.0100', 'type': 'DYNAMIC',
          'vlan': '10', 'destination_port': ['GigabitEthernet0/1']}, ...]
"""

import argparse
import sys
from pprint import pprint

try:
    from netmiko import ConnectHandler
    from netmiko.utilities import get_structured_data
except ImportError:
    print("ERROR: netmiko is not installed. Run: pip install netmiko")
    sys.exit(1)

COMMANDS = ["show ip arp", "show mac address-table"]


def run(host: str, username: str, password: str, platform: str) -> None:
    """Connect to the device and print raw + TextFSM-parsed output for each command."""
    print(f"\nConnecting to {host} ({platform}) as {username}...")
    device = {
        "device_type": platform,
        "host": host,
        "username": username,
        "password": password,
        "timeout": 30,
    }

    try:
        with ConnectHandler(**device) as conn:
            print(f"Connected. Prompt: {conn.find_prompt()!r}\n")

            for cmd in COMMANDS:
                print("=" * 70)
                print(f"COMMAND: {cmd}")
                print("=" * 70)

                # Raw output
                raw = conn.send_command(cmd, use_textfsm=False)
                print("\n--- RAW OUTPUT (first 3000 chars) ---")
                print(raw[:3000])
                if len(raw) > 3000:
                    print(f"  ... ({len(raw) - 3000} more chars)")

                # TextFSM parsed output
                print("\n--- TextFSM PARSED OUTPUT ---")
                try:
                    parsed = get_structured_data(raw, platform=platform, command=cmd)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        print(f"Total rows: {len(parsed)}")
                        print(f"\nField names: {list(parsed[0].keys())}")
                        print("\nFirst 5 rows:")
                        for row in parsed[:5]:
                            pprint(row)
                    elif isinstance(parsed, list):
                        print("Parsed OK but result is empty (0 rows)")
                    else:
                        print(
                            f"TextFSM template NOT available for this command/platform."
                            f"\n  Returned type: {type(parsed).__name__}"
                            f"\n  Value: {str(parsed)[:200]!r}"
                        )
                except Exception as exc:
                    print(f"TextFSM parsing error: {exc}")

                print()

    except Exception as exc:
        print(f"\nERROR: Could not connect or execute commands: {exc}")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Test TextFSM parsing of ARP and MAC address table commands",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--host", "-H", required=True, help="Device IP or hostname")
    parser.add_argument("--username", "-u", required=True, help="SSH username")
    parser.add_argument("--password", "-p", required=True, help="SSH password")
    parser.add_argument(
        "--platform",
        default="cisco_ios",
        help="Netmiko device type (default: cisco_ios)",
    )
    args = parser.parse_args()

    run(
        host=args.host,
        username=args.username,
        password=args.password,
        platform=args.platform,
    )


if __name__ == "__main__":
    main()
