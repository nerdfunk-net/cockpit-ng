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
session.max_redirects = 100  # increase if necessary

etag = "*"

resp = session.post(
    f"{API_URL}/domain-types/activation_run/actions/activate-changes/invoke",
    headers={
        "If-Match": etag,  # (required) The value of the, to be modified, object's ETag header.
        "Content-Type": 'application/json',  # (required) A header specifying which type of content is in the request/response body.
    },
    json={
        "redirect": False,
        "sites": [SITE_NAME],
        "force_foreign_changes": True, # optional: Will activate changes even if the user who made those changes is not the currently logged in user.
    },
    allow_redirects=True,
)
if resp.status_code == 200:
    pprint.pprint(resp.json())
elif resp.status_code == 303:
    print('Redirected to', resp.headers['location'])
else:
    raise RuntimeError(pprint.pformat(resp.json()))