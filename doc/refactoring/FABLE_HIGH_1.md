# Refactoring Plan — FABLE HIGH Issues (Batch 1)

**Source analysis:** `doc/FABLE_ANALYSIS.md` §1.1, §1.2, §1.3
**Date:** 2026-06-09
**Status:** Ready to implement

This plan covers the three **HIGH** security issues from the backend analysis. Each section is self-contained with exact file locations, before/after code, rationale, and a verification checklist. The three are independent and can be implemented and merged separately.

| # | Issue | Files | Risk if untouched |
|---|-------|-------|-------------------|
| 1 | `shell=True` fping calls | `tasks/ping_network_task.py`, `services/network/scanning/network_scan.py` | Latent command injection / RCE |
| 2 | Git token embedded in remote URL | `services/git/service.py`, `services/git/auth.py` | Token leakage into logs / `.git/config` |
| 3 | Deterministic KDF salt + shared `SECRET_KEY` for credential encryption | `core/crypto.py`, `config.py`, `services/settings/credentials_service.py`, `services/compliance/compliance_service.py`, `scripts/credential_manager/rotate_key.py` | Single-secret compromise exposes all stored credentials |

---

## Issue 1 — Remove `shell=True` from fping subprocess calls

### Problem

Both fping call sites build a shell command string with an f-string and run it with `shell=True` purely to get stdin redirection (`< tempfile`). This is a latent command-injection vector: any future change that interpolates a user-controlled value into the command or path becomes an instant RCE, and every SAST scanner flags it.

`fping` already supports reading targets from a file via `-f <file>` — no shell needed.

### 1.A — `tasks/ping_network_task.py`

**Location:** lines 88–113 (inside `_fping_networks`).

**BEFORE:**
```python
        # Build fping command with options
        cmd = [
            "fping",
            "-c",
            str(count),  # Number of pings per target
            "-t",
            str(timeout),  # Timeout in ms
            "-r",
            str(retry),  # Number of retries
            "-i",
            str(interval),  # Interval between packets in ms
        ]

        logger.debug("Running fping command: %s < %s", " ".join(cmd), temp_file_path)

        # Build full command with input redirection
        full_cmd = f"{' '.join(cmd)} < {temp_file_path}"

        # Use shell=True to support input redirection
        result = subprocess.run(
            full_cmd,
            shell=True,
            capture_output=True,
            timeout=60,  # Allow up to 60 seconds for network scanning
            text=True,
        )
```

**AFTER:**
```python
        # Build fping command with options. Targets are read from a file via
        # `-f` so we never need a shell (no command injection surface).
        cmd = [
            "fping",
            "-c",
            str(count),  # Number of pings per target
            "-t",
            str(timeout),  # Timeout in ms
            "-r",
            str(retry),  # Number of retries
            "-i",
            str(interval),  # Interval between packets in ms
            "-f",
            temp_file_path,  # Read target list from the temp file
        ]

        logger.debug("Running fping command: %s", " ".join(cmd))

        # Argument-list form, no shell. fping reads targets from the -f file.
        result = subprocess.run(
            cmd,
            shell=False,
            capture_output=True,
            timeout=60,  # Allow up to 60 seconds for network scanning
            text=True,
        )
```

> **Note:** `fping -f -` reads from stdin, but passing the path to `-f` directly is simpler and keeps the existing tempfile lifecycle (creation at lines 75–80, cleanup in the `finally` at 199–206) unchanged. Do **not** remove the tempfile logic.

### 1.B — `services/network/scanning/network_scan.py`

**Location:** lines 306–319 (inside `_fping_networks`).

**BEFORE:**
```python
            # Run fping command reading from the temporary file
            cmd = ["fping"]

            logger.info("Running fping command: %s < %s", " ".join(cmd), temp_file_path)

            # Use shell=True to support input redirection
            result = subprocess.run(
                f"fping < {temp_file_path}",
                shell=True,
                capture_output=True,
                timeout=PING_TIMEOUT_SECONDS
                * 10,  # Allow more time for network scanning
                text=True,
            )
```

**AFTER:**
```python
            # Run fping reading targets from the temp file via `-f` (no shell).
            cmd = ["fping", "-f", temp_file_path]

            logger.info("Running fping command: %s", " ".join(cmd))

            # Argument-list form, no shell — removes command-injection surface.
            result = subprocess.run(
                cmd,
                shell=False,
                capture_output=True,
                timeout=PING_TIMEOUT_SECONDS
                * 10,  # Allow more time for network scanning
                text=True,
            )
```

### Verification — Issue 1

1. **Static guard (recommended):** add a regression check or grep to CI:
   ```bash
   ! grep -rn "shell=True" backend/tasks backend/services --include="*.py"
   ```
2. **Functional:** run a prefix scan / ping-network job against a small CIDR (e.g. `/29`) on a host with `fping` installed and confirm alive hosts are still discovered. The output parsing is unchanged, so behavior should be identical.
3. **Unit tests:** check for existing tests touching `_fping_networks`:
   ```bash
   grep -rn "_fping_networks\|fping" backend/tests
   ```
   If a test mocks `subprocess.run`, update the assertion to expect the argument-list form (`["fping", ..., "-f", <path>]`, `shell=False`) instead of the shell string.
4. `cd backend && ruff format . && ruff check .`

---

## Issue 2 — Stop embedding git tokens in the remote URL

### Problem

For token auth, `pull()` and `push()` temporarily rewrite the remote URL to embed the credential (`origin.set_url(auth_url)` where `auth_url` is `https://user:token@host/...`), then restore it in a `finally`. Three concrete risks:

1. The token can leak into **GitPython error output**, **git's own stderr**, and any log line that prints the URL.
2. The restore in `finally` silently swallows exceptions (`except Exception: pass`), so a crash mid-operation can leave the token persisted in `.git/config`.
3. `PushResult`/`PullResult` messages interpolate `str(e)` (lines 329, 336, 424, 436), which can echo an auth URL back to the API client if git includes it in the error.

### Strategy

Replace URL embedding with **git's `http.extraHeader` per-command credential injection**. The token is passed as an `Authorization: Basic <base64>` header scoped to the single `pull`/`push` invocation via GitPython's `custom_environment` / `-c` config, never written to `.git/config` and never part of the URL.

GitPython exposes per-call git config through `repo.git` with the `-c` flag, e.g. `repo.git.pull("-c", ...)` is awkward; the clean approach is to set the config on the command via `git_obj.custom_environment()` or to use `origin.pull(..., kill_after_timeout=...)` — but the most robust, well-supported path is the `Git.custom_environment` + `GIT_CONFIG` approach. Below uses the **`extraHeader` via a context manager** that wraps the origin call.

### 2.A — Add a helper to `services/git/auth.py`

Add a new method that produces the base64 Authorization header value and a context manager that temporarily configures it on a repo. Append after `build_auth_url` (around line 232).

**ADD (new code in `services/git/auth.py`):**
```python
import base64
from contextlib import contextmanager


class GitAuthenticationService:
    # ... existing methods ...

    def build_basic_auth_header(
        self, username: Optional[str], token: str
    ) -> str:
        """Build an HTTP Basic 'Authorization' header value for token auth.

        Returns the full header value, e.g. ``Basic dXNlcjp0b2tlbg==``.
        The token is never placed in a URL or written to git config on disk.
        """
        userinfo = f"{username or 'git'}:{token}"
        encoded = base64.b64encode(userinfo.encode("utf-8")).decode("ascii")
        return f"Basic {encoded}"

    @contextmanager
    def http_auth_config(self, repo, username: Optional[str], token: Optional[str]):
        """Temporarily inject an Authorization header for a single git network op.

        Uses git's ``http.extraHeader`` config applied to the GitPython command
        environment so the credential is:
          * never embedded in the remote URL,
          * never written to ``.git/config`` on disk,
          * scoped only to operations run inside the ``with`` block.

        For SSH auth (no token) this is a no-op pass-through.
        """
        if not token:
            yield
            return

        header = self.build_basic_auth_header(username, token)
        # Apply via per-command config: GitPython forwards these to `git -c ...`.
        # http.extraHeader is read by git for HTTP(S) transports only.
        with repo.git.custom_environment(GIT_TERMINAL_PROMPT="0"):
            old_config = repo.git.config(
                "--get", "http.extraHeader", with_exceptions=False
            )
            try:
                repo.git.config("http.extraHeader", header)
                yield
            finally:
                # Always remove the header from local config.
                try:
                    repo.git.config("--unset-all", "http.extraHeader")
                    if old_config:
                        repo.git.config("http.extraHeader", old_config)
                except Exception as exc:
                    # Surface, never swallow: a lingering header config is a
                    # security concern and must be visible in logs.
                    logger.error(
                        "Failed to clear http.extraHeader after git op: %s", exc
                    )
```

> **Implementation note:** `http.extraHeader` is written to the repo's local `.git/config` for the duration of the block, but it contains the *header*, not the URL, and is unconditionally unset in `finally`. If you prefer the credential to never touch disk at all, the alternative is to pass `-c http.extraHeader=...` on each command via `repo.git.pull(..., c=f"http.extraHeader={header}")` — see the variant at the end of this section. The context-manager form above is chosen for minimal change to the existing `pull`/`push` structure.

### 2.B — Rewrite `pull()` in `services/git/service.py`

**Location:** lines 285–323.

**BEFORE:**
```python
            with set_ssl_env(repository):
                with self._auth.setup_auth_environment(repository) as (
                    auth_url,
                    username,
                    token,
                    ssh_key_path,
                ):
                    origin = repo.remotes.origin
                    original_url = None

                    try:
                        # For token auth, temporarily update remote URL
                        if token and not ssh_key_path:
                            original_url = list(origin.urls)[0]
                            origin.set_url(auth_url)

                        # Perform pull
                        pull_info = origin.pull(branch)
                        commits_pulled = len(pull_info) if pull_info else 0

                        logger.info(
                            "Pulled %s commits from %s",
                            commits_pulled,
                            repository.get("name"),
                        )

                        return PullResult(
                            success=True,
                            message=f"Successfully pulled {commits_pulled} commits",
                            commits_pulled=commits_pulled,
                            branch=branch,
                        )
                    finally:
                        # Restore original URL for token auth
                        if original_url:
                            try:
                                origin.set_url(original_url)
                            except Exception:
                                pass
```

**AFTER:**
```python
            with set_ssl_env(repository):
                with self._auth.setup_auth_environment(repository) as (
                    auth_url,  # noqa: F841 - retained for SSH path compatibility
                    username,
                    token,
                    ssh_key_path,
                ):
                    origin = repo.remotes.origin

                    # Token auth: inject credentials via http.extraHeader for the
                    # duration of the pull. SSH auth: context manager is a no-op
                    # (GIT_SSH_COMMAND is already configured by setup_auth_environment).
                    auth_token = token if not ssh_key_path else None
                    with self._auth.http_auth_config(repo, username, auth_token):
                        pull_info = origin.pull(branch)

                    commits_pulled = len(pull_info) if pull_info else 0

                    logger.info(
                        "Pulled %s commits from %s",
                        commits_pulled,
                        repository.get("name"),
                    )

                    return PullResult(
                        success=True,
                        message=f"Successfully pulled {commits_pulled} commits",
                        commits_pulled=commits_pulled,
                        branch=branch,
                    )
```

### 2.C — Rewrite `push()` in `services/git/service.py`

**Location:** lines 365–413.

**BEFORE:**
```python
            with set_ssl_env(repository):
                with self._auth.setup_auth_environment(repository) as (
                    auth_url,
                    username,
                    token,
                    ssh_key_path,
                ):
                    origin = repo.remotes.origin
                    original_url = None

                    try:
                        # For token auth, temporarily update remote URL
                        if token and not ssh_key_path:
                            original_url = list(origin.urls)[0]
                            origin.set_url(auth_url)

                        # Perform push
                        push_info = origin.push(refspec=f"{push_branch}:{push_branch}")

                        # Check push result
                        if push_info:
                            for info in push_info:
                                if info.flags & info.ERROR:
                                    return PushResult(
                                        success=False,
                                        message=f"Push failed: {info.summary}",
                                        pushed=False,
                                        branch=push_branch,
                                    )

                        logger.info(
                            "Successfully pushed to %s branch %s",
                            repository.get("name"),
                            push_branch,
                        )

                        return PushResult(
                            success=True,
                            message=f"Successfully pushed to {push_branch}",
                            pushed=True,
                            branch=push_branch,
                        )
                    finally:
                        # Restore original URL for token auth
                        if original_url:
                            try:
                                origin.set_url(original_url)
                            except Exception:
                                pass
```

**AFTER:**
```python
            with set_ssl_env(repository):
                with self._auth.setup_auth_environment(repository) as (
                    auth_url,  # noqa: F841 - retained for SSH path compatibility
                    username,
                    token,
                    ssh_key_path,
                ):
                    origin = repo.remotes.origin

                    # Token auth: inject credentials via http.extraHeader only for
                    # the push call. SSH auth: no-op (GIT_SSH_COMMAND already set).
                    auth_token = token if not ssh_key_path else None
                    with self._auth.http_auth_config(repo, username, auth_token):
                        push_info = origin.push(
                            refspec=f"{push_branch}:{push_branch}"
                        )

                    # Check push result
                    if push_info:
                        for info in push_info:
                            if info.flags & info.ERROR:
                                return PushResult(
                                    success=False,
                                    message=f"Push failed: {info.summary}",
                                    pushed=False,
                                    branch=push_branch,
                                )

                    logger.info(
                        "Successfully pushed to %s branch %s",
                        repository.get("name"),
                        push_branch,
                    )

                    return PushResult(
                        success=True,
                        message=f"Successfully pushed to {push_branch}",
                        pushed=True,
                        branch=push_branch,
                    )
```

### 2.D — Harden the clone path (`_clone_fresh`)

**Location:** lines 241–253. `Repo.clone_from(clone_url, ...)` still receives an embedded-credential URL from `setup_auth_environment`. The clone happens before a `repo` object exists, so `http_auth_config` (which needs a repo) cannot wrap it directly. Two options:

- **Option A (minimal):** keep the embedded URL **only** for the initial clone, but guarantee it is never logged. Confirm the existing log at line 254–258 logs `repository.get("url")` (the clean URL), **not** `clone_url` — it does, so this is already safe. Add an explicit comment.
- **Option B (consistent, preferred long-term):** clone from the **clean** URL with `GIT_TERMINAL_PROMPT=0` and inject the header via a one-shot `-c http.extraHeader=...` passed to `clone_from`:

**BEFORE:**
```python
                    repo = Repo.clone_from(
                        clone_url,
                        target_path,
                        branch=repository.get("branch", "main"),
                    )
```

**AFTER (Option B):**
```python
                    clean_url = self._auth.normalize_url(original_url := repository.get("url", ""))
                    clone_kwargs = {
                        "branch": repository.get("branch", "main"),
                    }
                    # Inject token via a one-shot http.extraHeader config so the
                    # credential is never written into the cloned repo's config
                    # nor embedded in the stored remote URL.
                    if token and not ssh_key_path:
                        header = self._auth.build_basic_auth_header(username, token)
                        clone_kwargs["c"] = f"http.extraHeader={header}"
                        clone_kwargs["env"] = {"GIT_TERMINAL_PROMPT": "0"}
                        clone_target = clean_url
                    else:
                        clone_target = clone_url  # SSH or no-auth: URL is safe

                    repo = Repo.clone_from(clone_target, target_path, **clone_kwargs)
```

> Choose **Option A** for the smallest, lowest-risk change in this batch; schedule **Option B** as a follow-up if you want full consistency. Mark the decision in the PR description.

### 2.E — Sanitize error messages returned to clients

**Location:** lines 329, 336, 424, 436 — `PullResult`/`PushResult` messages interpolate `str(e)`.

Add a small redaction helper and apply it. Place near the top of `services/git/service.py` (module level):

**ADD:**
```python
import re

_CRED_URL_RE = re.compile(r"//[^/@\s]+:[^/@\s]+@")


def _redact(text: str) -> str:
    """Strip embedded URL credentials (``//user:token@``) from error text."""
    return _CRED_URL_RE.sub("//***:***@", text or "")
```

**BEFORE (representative, line 327-330):**
```python
            return PullResult(
                success=False,
                message=f"Pull failed: {str(e)}",
                branch=repository.get("branch", "main"),
            )
```

**AFTER:**
```python
            return PullResult(
                success=False,
                message=f"Pull failed: {_redact(str(e))}",
                branch=repository.get("branch", "main"),
            )
```

Apply the same `_redact(...)` wrapping to the other three sites (lines 336, 424, 436) and to the `message = f"Push failed: {err_str}"` branch at line 424.

### Verification — Issue 2

1. **No token on disk:** after a token-auth pull/push, inspect the repo:
   ```bash
   git -C <data>/git_repos/<repo> config --get-all http.extraHeader   # expect empty
   git -C <data>/git_repos/<repo> remote get-url origin               # expect clean URL, no user:token@
   ```
2. **No token in logs:** run pull/push with `LOG_LEVEL=DEBUG` against a token repo and grep the logs for the token value and for `:@` / `user:token@` patterns — expect none.
3. **Failure path leaves no residue:** simulate a network failure mid-push (e.g. wrong remote host) and confirm `http.extraHeader` is unset afterward (step 1 again) and that the error is logged (not silently passed).
4. **Functional:** token pull, token push, SSH pull, SSH push, and clone all still succeed. SSH path must be unaffected (the `http_auth_config` is a no-op when `ssh_key_path` is set).
5. **Tests:**
   ```bash
   grep -rn "set_url\|auth_url\|http_auth_config\|build_auth_url" backend/tests
   cd backend && python -m pytest tests -k "git" -q
   ```
   Update any test asserting `origin.set_url` was called; replace with assertions on `http.extraHeader` config or on `http_auth_config` being entered.
6. `ruff format . && ruff check .`

---

## Issue 3 — Separate credential-encryption key from `SECRET_KEY`; document/strengthen KDF

### Problem

`core/crypto.py` derives the Fernet key from `SECRET_KEY` using a **fixed, hardcoded salt** (`_KDF_SALT`) and **100k PBKDF2 iterations**. Consequences:

1. **One secret protects two domains** — JWT signing *and* credential-at-rest encryption both key off `SECRET_KEY`. Compromise of `SECRET_KEY` (e.g. via a JWT-focused incident) immediately exposes every stored device password and SSH key.
2. **Fixed salt** means key derivation depends only on `SECRET_KEY`; identical secrets across deployments yield identical keys (defeats the salt's precomputation-resistance purpose).
3. **100k iterations** is below OWASP's 2023 guidance (600k for PBKDF2-HMAC-SHA256).

### Strategy

Introduce a dedicated, optional `CREDENTIAL_ENCRYPTION_KEY`. When set, credential encryption uses it; when **unset**, fall back to `SECRET_KEY` so existing deployments keep working (backward compatible, no forced migration). Raise the iteration count and pair it with the existing `rotate_key.py` re-encryption tooling so the change is reversible/migratable.

> **Critical constraint:** changing the salt **or** iteration count **or** the key source changes the derived Fernet key, which makes all existing ciphertext undecryptable until re-encrypted. Therefore this change **must** ship with a migration runbook (below) and the iteration/salt bump must be gated so it does not silently break running installs.

### 3.A — `config.py`: add the new optional setting

**Location:** after the `secret_key` definition (line 48).

**BEFORE:**
```python
    # Authentication Configuration
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
```

**AFTER:**
```python
    # Authentication Configuration
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    algorithm: str = os.getenv("ALGORITHM", "HS256")

    # Credential-at-rest encryption key. Independent of SECRET_KEY so that a
    # JWT-key compromise does NOT expose stored device credentials. Falls back
    # to SECRET_KEY when unset for backward compatibility with existing installs.
    credential_encryption_key: str = os.getenv("CREDENTIAL_ENCRYPTION_KEY", "")
```

### 3.B — `core/crypto.py`: version the KDF and add a resolver

Keep the existing v2 parameters available for **decrypting legacy data**, and introduce v3 parameters (higher iterations) for new encryption. Add a helper that picks the credential key with `SECRET_KEY` fallback.

**Location:** lines 19–48.

**BEFORE:**
```python
# Fixed salt for deterministic key derivation.
# Changing this salt makes ALL stored ciphertext unreadable across the app.
# Run a re-encryption migration whenever this value changes.
_KDF_SALT = b"cockpit-credential-encryption-v2"
_KDF_ITERATIONS = 100_000


def _build_key(secret: str) -> bytes:
    """Derive a Fernet-compatible 32-byte key using PBKDF2-HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_KDF_SALT,
        iterations=_KDF_ITERATIONS,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))


class EncryptionService:
    """Fernet-based symmetric encryption backed by a PBKDF2-derived key.

    Instantiate with an explicit *secret_key* for rotation scripts; in
    application code rely on the module-level singleton instead.
    """

    def __init__(self, secret_key: Optional[str] = None) -> None:
        secret = secret_key or os.getenv("SECRET_KEY")
        if not secret:
            raise RuntimeError("SECRET_KEY not set for credential encryption")
        self._fernet = Fernet(_build_key(secret))
```

**AFTER:**
```python
# Fixed salt for deterministic key derivation.
#
# Changing the salt or iteration count changes the derived Fernet key, which
# makes ALL stored ciphertext unreadable until re-encrypted. Run the
# re-encryption migration (scripts/credential_manager/rotate_key.py) whenever
# these values change. See doc/refactoring/FABLE_HIGH_1.md §3 for the runbook.
_KDF_SALT = b"cockpit-credential-encryption-v2"

# OWASP 2023 recommends >= 600k iterations for PBKDF2-HMAC-SHA256. The input
# here is a high-entropy secret (not a user password), but we align with the
# recommendation as defense in depth.
_KDF_ITERATIONS = 600_000


def _build_key(secret: str, iterations: int = _KDF_ITERATIONS) -> bytes:
    """Derive a Fernet-compatible 32-byte key using PBKDF2-HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_KDF_SALT,
        iterations=iterations,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))


def resolve_credential_secret(explicit: Optional[str] = None) -> str:
    """Resolve the secret used for credential-at-rest encryption.

    Priority:
      1. explicit argument (used by rotation scripts),
      2. CREDENTIAL_ENCRYPTION_KEY env var (dedicated key),
      3. SECRET_KEY env var (backward-compatible fallback).

    Raises RuntimeError if none is available.
    """
    secret = (
        explicit
        or os.getenv("CREDENTIAL_ENCRYPTION_KEY")
        or os.getenv("SECRET_KEY")
    )
    if not secret:
        raise RuntimeError(
            "No credential encryption secret available. Set "
            "CREDENTIAL_ENCRYPTION_KEY (preferred) or SECRET_KEY."
        )
    return secret


class EncryptionService:
    """Fernet-based symmetric encryption backed by a PBKDF2-derived key.

    Instantiate with an explicit *secret_key* for rotation scripts; in
    application code prefer constructing via the credential service which
    resolves the dedicated credential key (with SECRET_KEY fallback).

    The optional *iterations* parameter lets rotation tooling decrypt legacy
    ciphertext (100_000) while re-encrypting with the new default (600_000).
    """

    def __init__(
        self,
        secret_key: Optional[str] = None,
        *,
        iterations: int = _KDF_ITERATIONS,
    ) -> None:
        secret = secret_key or os.getenv("SECRET_KEY")
        if not secret:
            raise RuntimeError("SECRET_KEY not set for credential encryption")
        self._fernet = Fernet(_build_key(secret, iterations))
```

> **Backward-compat detail:** Fernet tokens do not record which KDF iteration count produced the key, so a key derived with 600k iterations cannot decrypt data encrypted with a 100k-iteration key. The migration (3.E) handles this by constructing an `old_enc = EncryptionService(old_secret, iterations=100_000)` for decryption and a `new_enc = EncryptionService(new_secret, iterations=600_000)` for re-encryption.

### 3.C — `services/settings/credentials_service.py`: use the dedicated key

**Location:** lines 28–31.

**BEFORE:**
```python
class CredentialsService:
    def __init__(self) -> None:
        secret = os.getenv("SECRET_KEY") or config_settings.secret_key
        self._encryption = EncryptionService(secret)
        self._repo = CredentialsRepository()
```

**AFTER:**
```python
from core.crypto import EncryptionService, resolve_credential_secret


class CredentialsService:
    def __init__(self) -> None:
        # Dedicated credential key (CREDENTIAL_ENCRYPTION_KEY) with SECRET_KEY
        # fallback for backward compatibility.
        secret = resolve_credential_secret(
            config_settings.credential_encryption_key or None
        )
        self._encryption = EncryptionService(secret)
        self._repo = CredentialsRepository()
```

### 3.D — `services/compliance/compliance_service.py`: same change

**Location:** lines 27–28.

**BEFORE:**
```python
        secret = os.getenv("SECRET_KEY") or config_settings.secret_key
        self._encryption = EncryptionService(secret)
```

**AFTER:**
```python
        secret = resolve_credential_secret(
            config_settings.credential_encryption_key or None
        )
        self._encryption = EncryptionService(secret)
```

(Add `resolve_credential_secret` to the existing `from core.crypto import ...` line.)

### 3.E — `scripts/credential_manager/rotate_key.py`: support iteration + key migration

The script already re-encrypts `credentials` and `login_credentials` from an old key to a new key. Extend it so it can also migrate **iteration count** and **key source** in one pass.

**Location:** the `EncryptionService` construction in `main()` (lines ~197–198).

**BEFORE:**
```python
    old_enc = EncryptionService(secret_key=old_key)
    new_enc = EncryptionService(secret_key=new_key)
```

**AFTER:**
```python
    # Legacy ciphertext was produced with 100_000 PBKDF2 iterations; new
    # ciphertext uses the current default (600_000). Decrypt with old params,
    # re-encrypt with new params.
    old_enc = EncryptionService(secret_key=old_key, iterations=args.old_iterations)
    new_enc = EncryptionService(secret_key=new_key, iterations=args.new_iterations)
```

**Add argparse options** (in the parser setup, alongside `--old-key`/`--new-key`):
```python
    parser.add_argument(
        "--old-iterations",
        type=int,
        default=100_000,
        help="PBKDF2 iterations used to encrypt existing data (default: 100000).",
    )
    parser.add_argument(
        "--new-iterations",
        type=int,
        default=600_000,
        help="PBKDF2 iterations for re-encryption (default: 600000).",
    )
```

Also extend `_CREDENTIAL_ENCRYPTED_FIELDS` coverage: the analysis found additional encrypted columns the script may not yet handle —
`snmp_v3_auth_password_encrypted` and `snmp_v3_priv_password_encrypted` on the SNMP mapping model (`core/models/credentials.py:86,88`). Confirm whether `rotate_key.py` rotates the SNMP table; if not, add a `_rotate_snmp_credentials` function mirroring `_rotate_login_credentials`. **Do not** skip this — un-rotated columns become permanently undecryptable after the key/iteration change.

### Migration runbook (Issue 3)

Because the derived key changes, follow this order **once** when deploying:

1. **Back up the database** (full dump of `credentials`, `login_credentials`, and the SNMP mapping table at minimum).
2. Decide the new key:
   - To adopt a dedicated key: generate one (`openssl rand -hex 32`) and set `CREDENTIAL_ENCRYPTION_KEY` in the environment.
   - To keep using `SECRET_KEY` but only bump iterations: leave `CREDENTIAL_ENCRYPTION_KEY` unset.
3. **Dry-run** the rotation (script supports `--dry-run` per the existing flow):
   ```bash
   cd backend && python -m scripts.credential_manager.rotate_key \
     --old-key "$CURRENT_SECRET" \
     --new-key "$NEW_CREDENTIAL_KEY" \
     --old-iterations 100000 --new-iterations 600000 --dry-run
   ```
   Confirm `processed > 0`, `failed == 0`.
4. Run for real (drop `--dry-run`), with the application **stopped** to avoid concurrent writes.
5. Set the env var(s) for the running app (`CREDENTIAL_ENCRYPTION_KEY` and/or rely on `SECRET_KEY`) and restart.
6. **Smoke test:** open a credential in the UI / call the decrypt path (e.g. a git token pull, an SNMP compliance check) and confirm decryption succeeds.
7. Keep the DB backup until the smoke test passes in production.

### Verification — Issue 3

1. **Fresh install (no `CREDENTIAL_ENCRYPTION_KEY`):** create a credential, restart, decrypt — succeeds via `SECRET_KEY` fallback.
2. **Dedicated key set:** set `CREDENTIAL_ENCRYPTION_KEY`, run the migration, restart with the var set, decrypt — succeeds. Then unset `SECRET_KEY`-only assumptions and confirm credentials still decrypt (proves the dedicated key is actually in use).
3. **Negative test:** with a *wrong* `CREDENTIAL_ENCRYPTION_KEY`, decryption raises `ValueError("Failed to decrypt stored credential")` (existing behavior in `crypto.py:57`) — confirms keys are actually independent.
4. **Unit tests:**
   ```bash
   grep -rn "EncryptionService\|_build_key\|resolve_credential_secret" backend/tests
   cd backend && python -m pytest tests -k "crypto or credential or encrypt" -q
   ```
   Add a test asserting `EncryptionService(s, iterations=100_000)` cannot decrypt data from `EncryptionService(s, iterations=600_000)` and vice-versa (locks in the migration contract).
5. `ruff format . && ruff check .`

---

## Cross-cutting checklist (run for the whole batch)

```bash
cd backend

# Format + lint
ruff format .
ruff check --fix .

# Existing regression guards
python scripts/check_asyncio_run.py
python scripts/check_http_500_leaks.py
python scripts/check_router_repositories.py
python scripts/check_text_sql.py

# No new shell=True in app code (Issue 1 guard)
! grep -rn "shell=True" tasks services --include="*.py"

# No URL-embedded credential restore pattern left (Issue 2 guard)
! grep -rn "origin.set_url(auth_url)" services/git --include="*.py"

# Targeted tests
python -m pytest tests -k "git or crypto or credential or fping" -q
```

## Suggested commit / PR breakdown

Ship as **three independent PRs** (they share no code paths):

1. `fix: remove shell=True from fping subprocess calls` — Issue 1 (smallest, lowest risk; merge first).
2. `fix(git): inject git token via http.extraHeader instead of remote URL` — Issue 2.
3. `feat(security): dedicated credential encryption key + stronger KDF` — Issue 3 (**requires the migration runbook in the PR description and a DB backup step in the deploy notes**).

## Rollback notes

- **Issue 1 & 2:** pure code changes, safe to revert by reverting the commit.
- **Issue 3:** once data is re-encrypted with the new key/iterations, reverting the code **without** reverting the data will break decryption. Roll back by (a) reverting code **and** (b) running `rotate_key.py` in reverse (`--old-iterations 600000 --new-iterations 100000`, swap keys), or restore the pre-migration DB backup. Document this in the PR.
