# MCP Server — Implementation Instructions

Purpose
-------
This document describes a practical, minimal starting point for implementing a Python-based MCP (Model Control Protocol) server
that will later act as middleware between an AI-based MCP client and the Cockpit API (e.g. Nautobot).

MCP Features
------------
The MCP provides an interface for using the Cockpit application's API to automate common workflows. Core capabilities include:
- Onboarding — initial setup and registration of devices and users.
- Scan and add — discover devices and add them to inventory.
- Backup — create and manage backups of device configurations and state.
- Sync devices — keep device inventories and configurations synchronized across systems.
- Compare — compare device configurations, inventories, or snapshots for differences.


Goals
-----
- Provide a secure, small, testable server scaffold written in Python.
- Expose a simple HTTP/JSON API the MCP client can call to request actions.
- Validate requests, do lightweight authorization, forward/transform to backend APIs, and return unified responses.
- Be easy to run locally and to containerize for deployment.

High-level plan
---------------
1. Pick a minimal stack: FastAPI + Uvicorn + Pydantic (async-first, type-safe, automatic OpenAPI).
2. Define the MCP message contract (requests/responses) and a small set of endpoints.
3. Implement config, logging, health, and metrics endpoints.
4. Implement auth middleware (API keys or JWT) and request validation.
5. Provide a simple router that accepts MCP requests, validates them, and returns deterministic responses.
6. Add tests and a dev run script / Dockerfile.

Checklist (requirements to satisfy)
----------------------------------
- [ ] FastAPI app scaffold and run instructions
- [ ] Health endpoint at `/health` or `/readyz`
- [ ] MCP API endpoint(s) (e.g. `/mcp/v1/execute`) with Pydantic request/response models
- [ ] Authentication middleware (API key header + optional JWT hooks)
- [ ] Config via env vars and a simple `config.py`
- [ ] Logging, structured JSON optional
- [ ] Example of how to call the Cockpit API (HTTP client abstraction)
- [ ] Tests (unit for models + a small integration smoke test using TestClient)

Contract: core MCP message shapes
--------------------------------
- MCPRequest (JSON):
	- id: str (client-generated request id)
	- action: str (verb, e.g. "inventory.sync", "config.apply")
	- params: dict (action parameters)
	- metadata: dict (optional client metadata)

- MCPResponse (JSON):
	- id: str (echo request id)
	- status: "ok" | "error"
	- result: dict | null (action output when status == ok)
	- error: { code: str, message: str, details?: any } | null

API Endpoints (minimal)
-----------------------
- GET /health
	- Returns 200/uptime/ok or 503 if critical checks fail.

- POST /mcp/v1/execute
	- Body: MCPRequest
	- Auth: API key header (e.g. `X-Api-Key`) or Bearer JWT
	- Response: MCPResponse

Project layout (recommended)
---------------------------
```
mcp/
├─ app.py                # creates FastAPI app, includes routes and middleware
├─ config.py             # settings via pydantic BaseSettings
├─ routes/
│  ├─ __init__.py
│  ├─ mcp.py             # MCP endpoint handlers
│  └─ health.py
├─ services/
│  ├─ __init__.py
│  ├─ client.py          # HTTP client wrapper to call Cockpit API (nautobot)
│  └─ dispatcher.py      # maps actions -> handler functions
├─ models/
│  ├─ mcp.py             # Pydantic models for request/response
├─ tests/
│  └─ test_mcp.py
├─ Dockerfile
└─ README.md
```

Minimal code skeleton (what to implement)
-----------------------------------------

- `config.py` (Pydantic settings)
	- Define MCP_SERVER_HOST, PORT, LOG_LEVEL, COCKPIT_API_URL, API_KEYS (comma separated) etc.

- `app.py` (FastAPI app)
	- Create FastAPI instance
	- Add middleware for CORS, logging, request id
	- Add authentication dependency that validates `X-Api-Key` header against configured keys
	- Include routers from `routes`
	- Provide startup/shutdown events to initialize HTTP client pools

- `models/mcp.py` (Pydantic models)
	- Define MCPRequest, MCPResponse, ErrorModel, ActionParamModel (as needed)

- `routes/mcp.py`
	- POST /mcp/v1/execute: validate body as MCPRequest, call dispatcher to handle action
	- Wrap call in try/except, return status "error" with error code/message on exceptions

- `services/dispatcher.py`
	- Implement a `dispatch(request: MCPRequest) -> dict` function that maps `action` names to handlers
	- Handlers are simple `async def` functions that accept params and return dict results
	- Keep one example handler like `inventory.list` that calls `services.client` to fetch from cockpit

- `services/client.py`
	- Lightweight HTTP client wrapper using `httpx.AsyncClient` with retries and timeouts
	- Expose methods for the few backend calls MCP server will need

Auth & Security
---------------
- Start with simple API-key based auth via header `X-Api-Key`.
	- Put valid keys in `MCP_API_KEYS` (env var) or use a file.
	- Implement `Depends` function that checks header and raises 401 if missing/invalid.

- In a later iteration replace/augment with JWT and RBAC when needed.

Observability & Operations
--------------------------
- Logging: structured JSON optional. Use standard `logging` with configurable level.
- Metrics: expose a `/metrics` endpoint (Prometheus) or instrument events if required.
- Health: `/health` and `/readyz` with simple checks (config loaded, httpx pool init).

Testing
-------
- Unit tests for: schema validation, dispatcher mapping, client mocking.
- Integration test: use `fastapi.testclient.TestClient` to call `/mcp/v1/execute` with a sample request and mocked service responses.

Run & Development
-----------------
- Local dev using uvicorn:
```bash
cd mcp
pip install -r ../backend/requirements.txt  # or a small requirements.txt in mcp/
uvicorn app:app --reload --host 127.0.0.1 --port 8001
```

- Docker: add a small `Dockerfile` that installs dependencies and runs `uvicorn app:app --host 0.0.0.0 --port 8001`.

Quality & Next steps
--------------------
- Add request/response logging with unique request IDs.
- Add strict timeouts & circuit breaker for backend calls.
- Add RBAC and per-action authorization.
- Add audit logging for all actions forwarded to the Cockpit API.

Example minimal `POST /mcp/v1/execute` flow
------------------------------------------
1. Client posts an MCPRequest with `action: "inventory.list"` and empty params.
2. Auth dependency validates API key and attaches `requestor` info.
3. Router passes MCPRequest to `dispatcher.dispatch`.
4. Dispatcher calls `services.client.get('/nautobot/api/...')` or a mocked stub and translates the response.
5. Router returns MCPResponse with status `ok` and the translated `result`.

Security reminder
-----------------
Never embed secret API keys in source. Use environment variables, k/v secret stores, or mounted files.

Supported assumptions for this guide
-----------------------------------
- Python 3.11+ recommended (project uses 3.12 in places; test locally with the same runtime as deployment).
- FastAPI and httpx are available and acceptable dependencies in your project.

Deliverables for initial PR
--------------------------
- `mcp/app.py` FastAPI scaffold with auth middleware and routes included
- `mcp/models/mcp.py` Pydantic models
- `mcp/routes/mcp.py` + `mcp/routes/health.py`
- `mcp/services/client.py` + `mcp/services/dispatcher.py` with a single example action
- `mcp/tests/test_mcp.py` with a TestClient smoke test
- `mcp/Dockerfile` and `mcp/README.md` with run instructions

Wrap-up
-------
This doc gives a compact, pragmatic way to bootstrap an MCP server suitable for local development and later extension. If you want, I can generate the initial code files and a PR scaffolded with the exact skeleton described above.

