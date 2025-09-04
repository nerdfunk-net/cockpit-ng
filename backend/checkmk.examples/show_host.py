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

resp = session.get(
    f"{API_URL}/objects/host_config/server-001", # hostname
    params={  # goes into query string
        "effective_attributes": False,  # Show all effective attributes on hosts, not just the attributes which were set on this host specifically.
    },
)
if resp.status_code == 200:
    # pprint.pprint(resp.json())
    attributes = resp.json().get('extensions', {}).get('attributes', {})
    pprint.pprint(attributes)
else:
    raise RuntimeError(pprint.pformat(resp.json()))