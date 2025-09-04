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
new_folder = "~testfolder"

# get etag first
resp = session.get(
    f"{API_URL}/objects/host_config/{hostname}",  # The name of the host to retrieve the ETag for.
    params={
        "effective_attributes": False,  # Show all effective attributes on hosts, not just the attributes which were set on this host specifically.
    },
)
if resp.status_code == 200:
    etag = resp.headers['ETag']
    pprint.pprint(etag)
else:
    raise RuntimeError(pprint.pformat(resp.json()))

resp = session.post(
    f"{API_URL}/objects/host_config/{hostname}/actions/move/invoke",
    headers={
        "If-Match": etag,  # (required) The value of the, to be modified, object's ETag header.
        "Content-Type": 'application/json',  # (required) A header specifying which type of content is in the request/response body.
    },
    json={
        "target_folder": new_folder,
    },
)

if resp.status_code == 200:
    pprint.pprint(resp.json())
elif resp.status_code == 400:
    # check if we get the response "The host is already part of the specified target folder"
    detail = resp.json().get('detail', '')
    if detail == "The host is already part of the specified target folder":
        print(f"Host {hostname} is already in folder {new_folder}")
    else:
        raise RuntimeError(pprint.pformat(resp.json()))
else:
    raise RuntimeError(pprint.pformat(resp.json()))