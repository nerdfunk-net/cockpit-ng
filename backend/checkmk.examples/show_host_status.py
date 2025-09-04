#!/usr/bin/env python3
import pprint
import requests

HOST_NAME = "192.168.178.101:8080"
SITE_NAME = "cmk"
PROTO = "http" #[http|https]
API_URL = f"{PROTO}://{HOST_NAME}/{SITE_NAME}/check_mk/api/1.0"

USERNAME = "automation"
PASSWORD = "automation"

session = requests.session()
session.headers['Authorization'] = f"Bearer {USERNAME} {PASSWORD}"
session.headers['Accept'] = 'application/json'

hostname = "server-001"

resp = session.get(
    f"{API_URL}/objects/host/{hostname}",
    params={  # goes into query string
        "columns": [
                    "name",
                    "state",
                    "hard_state",
                    "state_type",
                    "plugin_output",
                    "last_check",
                    "last_state_change",
                    "has_been_checked",
                ]
    },
)
if resp.status_code == 200:
    data = resp.json()
    extensions = data["extensions"]

    # Extract host state and other information
    # Use hard_state for the actual monitoring status (more reliable than soft state)
    state = extensions.get("state")  # Soft state
    hard_state = extensions.get("hard_state")  # Hard state
    state_type = extensions.get("state_type")  # 0=soft, 1=hard
    has_been_checked = extensions.get("has_been_checked", 0)
    plugin_output = extensions.get("plugin_output", "No output available")
    last_check = extensions.get("last_check")
    last_state_change = extensions.get("last_state_change")

    print(f"Host: {hostname}")
    print(f"State: {state} (Hard State: {hard_state}, State Type: {'Hard' if state_type == 1 else 'Soft'})")
    print(f"Has Been Checked: {'Yes' if has_been_checked else 'No'}")
    print(f"Plugin Output: {plugin_output}")
    print(f"Last Check: {last_check}")
    print(f"Last State Change: {last_state_change}")
else:
    raise RuntimeError(pprint.pformat(resp.json()))