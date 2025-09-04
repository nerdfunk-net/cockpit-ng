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

resp = session.post(
    f"{API_URL}/domain-types/host/collections/all",
    headers={
        "Content-Type": 'application/json',  # (required) A header specifying which type of content is in the request/response body.
    },
    json={
        "sites": ["cmk"],
        "query": "{\"op\": \"and\", \"expr\": [{\"op\": \"=\", \"left\": \"name\", \"right\": \"server-001\"}, {\"op\": \"!=\", \"left\": \"state\", \"right\": \"0\"}]}",
        "columns": ["name","state","hard_state"],
    },
)
if resp.status_code == 200:
    pprint.pprint(resp.json())
else:
    raise RuntimeError(pprint.pformat(resp.json()))