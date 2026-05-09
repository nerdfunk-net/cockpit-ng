# Refactoring — Last Steps

**Date:** 2026-05-09  
**Scope:** Two remaining items from `doc/AUDIT_REPORT_RESULTS.md`  
**Branch:** continue on `refactoring/audit-steps-1-and-2` or open a new branch

---

## Overview

Two files were not fully refactored in the previous passes:

| File | Current Lines | Target | Problem |
|---|---|---|---|
| `routers/network/automation/netmiko.py` | 808 | ~200 | Business logic not extracted to service |
| `services/agents/deployment_service.py` | 792 | ~500 | Duplicated setup/teardown between `deploy()` and `deploy_multi()` |

---

## Step 1 — Extract Business Logic from Netmiko Router

### Problem

The router file violates the thin-router rule in two places:

**`execute_commands` (lines 29–205, 176 lines total)**  
Contains full credential resolution logic (lines 83–148) that builds the username/password from either a stored credential or manual input. This block is ~65 lines of business logic that also appears verbatim in `execute_template`.

**`execute_template` (lines 284–793, 509 lines total)**  
Contains the entire template execution pipeline:
- Template loading from `template_manager` (lines 334–357)
- Credential resolution — duplicated from `execute_commands` (lines 362–424)
- Per-device loop with Nautobot GraphQL calls, context building, Jinja2 rendering, TextFSM pre-run, and Netmiko execution (lines 439–765)

### Target State

After this step, the router has 4 endpoints, each 15–35 lines. Total: ~150 lines.  
`NetmikoService` gains 2 new methods.

---

### 1.1 — Add `resolve_credentials()` to `NetmikoService`

**File:** `services/network/automation/netmiko.py`

Add this method to `NetmikoService`. It replaces the duplicated block in both router endpoints.

```python
def resolve_credentials(
    self,
    credential_id: Optional[int],
    current_username: str,
    manual_username: Optional[str],
    manual_password: Optional[str],
) -> tuple[str, str]:
    """
    Resolve (username, password) from a stored credential or manual entry.

    Raises HTTPException on any resolution failure so the router
    can call this without try/except.
    """
    from fastapi import HTTPException, status

    if credential_id is None:
        if not manual_username or not manual_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username and password are required when not using stored credentials",
            )
        return manual_username, manual_password

    import service_factory
    cred_mgr = service_factory.build_credentials_service()

    general_creds = cred_mgr.list_credentials(include_expired=False, source="general")
    private_creds = cred_mgr.list_credentials(include_expired=False, source="private")
    user_private = [c for c in private_creds if c.get("owner") == current_username]

    credential = next(
        (c for c in general_creds + user_private if c["id"] == credential_id), None
    )

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Credential with ID {credential_id} not found or not accessible",
        )
    if credential["type"] != "ssh":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Credential must be of type 'ssh', got '{credential['type']}'",
        )

    password = cred_mgr.get_decrypted_password(credential_id)
    if not password:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt credential password",
        )

    return credential["username"], password
```

**Why here:** The credential resolution reads from the credentials service, applies domain rules (ssh-only, owner-scoping), and raises HTTP-level errors. It is business logic, not HTTP routing. The `NetmikoService` already depends on `service_factory` at runtime via other code paths.

---

### 1.2 — Add `execute_template_on_devices()` to `NetmikoService`

**File:** `services/network/automation/netmiko.py`

Extract the entire per-device loop from the router's `execute_template` into this method. It returns a plain dataclass/tuple (not an HTTP response model).

```python
async def execute_template_on_devices(
    self,
    *,
    device_ids: List[str],
    template_content: str,
    session_id: str,
    username: Optional[str],
    password: Optional[str],
    dry_run: bool,
    enable_mode: bool,
    write_config: bool,
    use_nautobot_context: bool,
    user_variables: Optional[Dict[str, Any]],
    pre_run_command: Optional[str],
    template_credential_id: Optional[int],
    nautobot_service,
    device_query_service,
) -> tuple[List[TemplateExecutionResult], Dict[str, int]]:
    """
    Execute a rendered Jinja2 template across a list of Nautobot device IDs.

    Returns (results, counters) where counters has keys:
        rendered, executed, failed, cancelled
    """
    ...  # move lines 432–765 from the router here verbatim, then clean up
```

**Signature notes:**
- All parameters are keyword-only (`*,`) for safety with this many args.
- `nautobot_service` and `device_query_service` are injected by the router (FastAPI Depends already resolves them), so passing them in is cleaner than re-fetching inside the service.
- Returns raw result list + counters dict, not `TemplateExecutionResponse`. The router maps those to the HTTP response.

**Graphql query:** The inline GraphQL query on lines 456–470 may be moved to a constant at the top of the service file (`_DEVICE_DETAILS_QUERY = """..."""`).

---

### 1.3 — Slim the Router

**File:** `routers/network/automation/netmiko.py`

After the two service methods exist, both router endpoints become thin:

**`execute_commands` target (~35 lines):**
```python
@router.post("/execute-commands", response_model=CommandExecutionResponse)
async def execute_commands(
    request: DeviceCommand,
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
    netmiko_service=Depends(get_netmiko_service),
) -> CommandExecutionResponse:
    if not request.devices:
        raise HTTPException(status_code=400, detail="No devices provided")
    if not request.commands:
        raise HTTPException(status_code=400, detail="No commands provided")

    username, password = netmiko_service.resolve_credentials(
        request.credential_id,
        current_user["username"],
        request.username,
        request.password,
    )

    session_id, results = await netmiko_service.execute_commands(
        devices=request.devices,
        commands=request.commands,
        username=username,
        password=password,
        enable_mode=request.enable_mode,
        write_config=request.write_config,
        use_textfsm=request.use_textfsm,
        session_id=request.session_id,
    )

    command_results = [CommandResult(**{**r, "error": r.get("error")}) for r in results]
    successful = sum(1 for r in results if r["success"])
    cancelled = sum(1 for r in results if r.get("cancelled", False))
    return CommandExecutionResponse(
        session_id=session_id,
        results=command_results,
        total_devices=len(results),
        successful=successful,
        failed=len(results) - successful - cancelled,
        cancelled=cancelled,
    )
```

**`execute_template` target (~55 lines):**
```python
@router.post("/execute-template", response_model=TemplateExecutionResponse)
async def execute_template(
    request: TemplateExecutionRequest,
    current_user: dict = Depends(require_permission("network.netmiko", "execute")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    netmiko_service=Depends(get_netmiko_service),
    device_query_service: DeviceQueryService = Depends(get_device_query_service),
) -> TemplateExecutionResponse:
    if not request.device_ids:
        raise HTTPException(status_code=400, detail="No devices provided")
    if not request.template_id and not request.template_content:
        raise HTTPException(status_code=400, detail="Either template_id or template_content must be provided")

    import service_factory
    template_manager = service_factory.build_template_service()

    template_content, pre_run_command, template_credential_id = _load_template(
        template_manager, request
    )

    username, password = (None, None)
    if not request.dry_run:
        username, password = netmiko_service.resolve_credentials(
            request.credential_id,
            current_user["username"],
            request.username,
            request.password,
        )

    session_id = request.session_id or str(uuid.uuid4())
    netmiko_service.register_session(session_id)

    results, counters = await netmiko_service.execute_template_on_devices(
        device_ids=request.device_ids,
        template_content=template_content,
        session_id=session_id,
        username=username,
        password=password,
        dry_run=request.dry_run,
        enable_mode=request.enable_mode,
        write_config=request.write_config,
        use_nautobot_context=request.use_nautobot_context,
        user_variables=request.user_variables,
        pre_run_command=pre_run_command,
        template_credential_id=template_credential_id,
        nautobot_service=nautobot_service,
        device_query_service=device_query_service,
    )

    netmiko_service.unregister_session(session_id)
    summary = {**counters, "total": len(request.device_ids)}
    return TemplateExecutionResponse(session_id=session_id, results=results, summary=summary)
```

Note: extract `_load_template(template_manager, request) -> (content, pre_run_command, credential_id)` as a module-level private function in the router (it's pure data loading, 15–20 lines, not worth a service method).

---

### 1.4 — Line Count After

| File | Before | After |
|---|---|---|
| `routers/network/automation/netmiko.py` | 808 | ~200 |
| `services/network/automation/netmiko.py` | ~450 | ~620 |

The router drops by ~600 lines. The service grows by ~170 lines (the logic being moved is dense and is partially re-used rather than just moved, so it compresses slightly).

---

## Step 2 — Remove Duplication from `AgentDeploymentService`

### Problem

`deploy()` and `deploy_multi()` share the same first two steps verbatim:

```
Step 1: Load agent config   → identical code in both methods
Step 2: Load git repo       → identical code in both methods
Step 3/4: Open git repo     → nearly identical
Step final: Commit/push + activate → structure is identical, inputs differ slightly
```

The duplication accounts for roughly 250 lines across the two methods. The helper methods (`_load_agent_config`, `_load_git_repository`, `_open_or_clone_repo`, `_commit_and_push`) are already extracted — but the glue code and error-handling wrappers are copy-pasted.

---

### 2.1 — Extract `_setup_deployment()`

This private method handles Steps 1–2 (and implicitly Step 3/4) for both `deploy()` and `deploy_multi()`.

```python
def _setup_deployment(
    self, agent_id: str, task_context=None
) -> tuple[Dict[str, Any], str, Dict[str, Any], Any, str]:
    """
    Load agent config, git repository, then clone/open the repo.

    Returns (agent, agent_name, repo_dict, repo, repo_path).
    Raises ValueError with a human-readable message on any configuration error.
    Raises GitCommandError if the repo cannot be prepared.
    """
    agent = self._load_agent_config(agent_id)
    agent_name = agent.get("name", agent_id)

    self._update_progress(task_context, 10, "Loading Git repository...")
    git_repository = self._load_git_repository(agent)
    repo_dict = self._repo_to_dict(git_repository)

    self._update_progress(task_context, 25, "Preparing Git repository...")
    repo, repo_path = self._open_or_clone_repo(repo_dict)

    return agent, agent_name, repo_dict, repo, repo_path, git_repository
```

Both `deploy()` and `deploy_multi()` replace their Steps 1–4 with a single call to `_setup_deployment()`.

---

### 2.2 — Extract `_commit_and_finalize()`

This private method handles the commit + push + conditional activation that ends both methods identically.

```python
def _commit_and_finalize(
    self,
    *,
    repo_dict: Dict[str, Any],
    repo,
    file_paths: List[str],
    commit_message: str,
    agent_id: str,
    agent_name: str,
    git_repository,
    activate_after_deploy: bool,
    username: str,
    task_context=None,
    extra_result_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Commit, push, and optionally activate the agent.

    Returns the final result dict (success or failure).
    Callers merge their own fields via extra_result_fields.
    """
    self._update_progress(task_context, 75, "Committing and pushing changes...")

    current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    result = self._commit_and_push(repo_dict, repo, file_paths, commit_message)

    if not result.success:
        return {
            "success": False,
            "error": f"Failed to commit/push to git: {result.message}",
            "agent_id": agent_id,
            "agent_name": agent_name,
            **(extra_result_fields or {}),
        }

    deployment_result = {
        "success": True,
        "agent_id": agent_id,
        "agent_name": agent_name,
        "commit_sha": result.commit_sha,
        "commit_sha_short": result.commit_sha[:8] if result.commit_sha else None,
        "repository_name": git_repository.name,
        "repository_url": git_repository.url,
        "branch": git_repository.branch or "main",
        "files_changed": result.files_changed,
        "pushed": result.pushed,
        "timestamp": current_date,
        "activated": False,
        **(extra_result_fields or {}),
    }

    if activate_after_deploy:
        activation_result = self._activate_agent(
            cockpit_agent_id=agent_id,
            agent_name=agent_name,
            username=username,
            task_context=task_context,
        )
        deployment_result.update(activation_result)

    return deployment_result
```

---

### 2.3 — `deploy()` After Extraction (~80 lines)

```python
async def deploy(
    self,
    template_id: int,
    agent_id: str,
    custom_variables: Optional[Dict[str, Any]] = None,
    path: Optional[str] = None,
    inventory_id: Optional[int] = None,
    activate_after_deploy: bool = True,
    task_context=None,
    username: str = "system",
) -> Dict[str, Any]:
    try:
        self._update_progress(task_context, 0, "Initializing agent deployment...")

        try:
            agent, agent_name, repo_dict, repo, repo_path, git_repository = (
                self._setup_deployment(agent_id, task_context)
            )
        except (ValueError, GitCommandError) as e:
            return {"success": False, "error": str(e), "agent_id": agent_id, "template_id": template_id}

        self._update_progress(task_context, 35, "Rendering template...")

        try:
            template_name, rendered_content, file_path = await self._render_template(
                template_id, path, inventory_id, custom_variables, username
            )
        except (ValueError, Exception) as e:
            return {"success": False, "error": str(e), "agent_id": agent_id, "template_id": template_id}

        self._update_progress(task_context, 60, "Writing configuration file...")
        self._write_file(repo_path, file_path, rendered_content)

        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        commit_message = f"Deploy {agent_name} - {template_name} - {current_date}"

        return self._commit_and_finalize(
            repo_dict=repo_dict,
            repo=repo,
            file_paths=[file_path.lstrip("/")],
            commit_message=commit_message,
            agent_id=agent_id,
            agent_name=agent_name,
            git_repository=git_repository,
            activate_after_deploy=activate_after_deploy,
            username=username,
            task_context=task_context,
            extra_result_fields={
                "template_id": template_id,
                "template_name": template_name,
                "file_path": file_path,
                "message": f"Successfully deployed configuration to git repository '{git_repository.name}'",
            },
        )
    except Exception as e:
        logger.error("Agent deployment failed: %s", e, exc_info=True)
        return {"success": False, "error": str(e), "agent_id": agent_id, "template_id": template_id}
```

---

### 2.4 — `deploy_multi()` After Extraction (~100 lines)

The structure is identical but iterates over `template_entries` before the commit:

```python
async def deploy_multi(self, template_entries, agent_id, activate_after_deploy=True, task_context=None, username="system"):
    try:
        self._update_progress(task_context, 0, "Initializing multi-template deployment...")

        try:
            agent, agent_name, repo_dict, repo, repo_path, git_repository = (
                self._setup_deployment(agent_id, task_context)
            )
        except (ValueError, GitCommandError) as e:
            return {"success": False, "error": str(e), "agent_id": agent_id}

        # Render each entry and write files
        template_results, all_file_paths, success_count = [], [], 0
        total = len(template_entries)

        for idx, entry in enumerate(template_entries):
            progress = 30 + int((idx / total) * 40)
            self._update_progress(task_context, progress, f"Rendering template {idx + 1}/{total}...")
            try:
                template_name, rendered_content, file_path = await self._render_template(
                    entry["template_id"], entry.get("path"),
                    entry.get("inventory_id"), entry.get("custom_variables") or {}, username,
                )
                self._write_file(repo_path, file_path, rendered_content)
                all_file_paths.append(file_path.lstrip("/"))
                template_results.append({"template_id": entry["template_id"], "template_name": template_name,
                                         "file_path": file_path, "success": True, "rendered_size": len(rendered_content)})
                success_count += 1
            except Exception as e:
                template_results.append({"template_id": entry.get("template_id"), "success": False, "error": str(e)})

        if success_count == 0:
            return {"success": False, "error": "All template renders failed", "agent_id": agent_id,
                    "agent_name": agent_name, "template_results": template_results}

        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        commit_message = f"Deploy {agent_name} - {success_count} templates - {current_date}"

        return self._commit_and_finalize(
            repo_dict=repo_dict, repo=repo, file_paths=all_file_paths,
            commit_message=commit_message, agent_id=agent_id, agent_name=agent_name,
            git_repository=git_repository, activate_after_deploy=activate_after_deploy,
            username=username, task_context=task_context,
            extra_result_fields={
                "template_results": template_results,
                "message": f"Successfully deployed {success_count} templates to git repository '{git_repository.name}'",
            },
        )
    except Exception as e:
        logger.error("Multi-template deployment failed: %s", e, exc_info=True)
        return {"success": False, "error": str(e), "agent_id": agent_id}
```

---

### 2.5 — Line Count After

| File | Before | After |
|---|---|---|
| `services/agents/deployment_service.py` | 792 | ~480 |

Reduction comes from:
- `deploy()`: 229 → 80 lines (−149)
- `deploy_multi()`: 248 → 100 lines (−148)
- New `_setup_deployment()`: +20 lines
- New `_commit_and_finalize()`: +45 lines
- Net: ~−230 lines

---

## Execution Order

1. **Step 2 first** — `deployment_service.py` is self-contained; no routing changes, no interface changes, pure internal refactor. Easy to verify: all callers of `deploy()` and `deploy_multi()` have the same signatures.

2. **Step 1 second** — Netmiko requires adding methods to the service AND updating the router. Do in this order:
   1. Add `resolve_credentials()` to `NetmikoService` — no callers yet, safe
   2. Add `execute_template_on_devices()` to `NetmikoService` — no callers yet, safe
   3. Rewrite `execute_commands` endpoint to use `resolve_credentials()` — functional change, test manually
   4. Rewrite `execute_template` endpoint to use both new methods — functional change, test manually
   5. Delete the dead code from the router

## Testing Checklist

After each step, verify:

- [ ] `POST /api/netmiko/execute-commands` — works with `credential_id`, works with manual username/password, fails gracefully on missing credentials
- [ ] `POST /api/netmiko/execute-template` — dry_run=true renders without executing, real run executes on all devices, cancellation via `POST /api/netmiko/cancel/{session_id}` still works
- [ ] Agent deploy via UI — single template deploys to git and activates
- [ ] Agent deploy multi — multiple templates commit in a single push
- [ ] Grep confirms no callers rely on the removed verbose logging step banners (`grep -r "STEP 1:" backend/`)
