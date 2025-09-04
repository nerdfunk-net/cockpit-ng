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

# get etag first
resp = session.get(
    f"{API_URL}/objects/host_config/server-001",  # The name of the host to retrieve the ETag for.
    params={
        "effective_attributes": False,  # Show all effective attributes on hosts, not just the attributes which were set on this host specifically.
    },
)
if resp.status_code == 200:
    etag = resp.headers['ETag']
    pprint.pprint(etag)
else:
    raise RuntimeError(pprint.pformat(resp.json()))

# now update host
resp = session.put(
    f"{API_URL}/objects/host_config/server-001",  # The name of the host to be modified.
    headers={
        "If-Match": etag,  # (required) The value of the, to be modified, object's ETag header.
        "Content-Type": 'application/json',  # (required) A header specifying which type of content is in the request/response body.
    },
    json={
        "attributes": {
            "ipaddress": "192.168.178.101",
            "alias": "My Updated Test Server",
        },
    },
)
if resp.status_code == 200:
    pprint.pprint(resp.json())
else:
    raise RuntimeError(pprint.pformat(resp.json()))