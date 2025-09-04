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
    f"{API_URL}/domain-types/host_config/collections/all",
    params={  # goes into query string
        "effective_attributes": False,  # Show all effective attributes on hosts, not just the attributes which were set on this host specifically.
        "include_links": False,  # Flag which toggles whether the links field of the individual hosts should be populated.
        "fields": '!(links)',  # The fields to include/exclude.
        # "hostnames": [],  # Filter the result by a list of host names.
        "site": 'cmk',  # Filter the result by a specific site.
    },
)
if resp.status_code == 200:
    pprint.pprint(resp.json())
else:
    raise RuntimeError(pprint.pformat(resp.json()))
