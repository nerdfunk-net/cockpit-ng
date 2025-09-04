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
    f"{API_URL}/domain-types/activation_run/collections/pending_changes",
)
if resp.status_code == 200:
    pprint.pprint(resp.json())
else:
    raise RuntimeError(pprint.pformat(resp.json()))