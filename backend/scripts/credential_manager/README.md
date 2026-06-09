# Credential Manager Scripts

Maintenance scripts for Cockpit credential storage.  Run all commands from the
**`backend/`** directory so that the Python path and `.env` file are resolved
correctly.

---

## Background: What Is Encrypted, and With Which Key?

There are two completely separate authentication mechanisms in Cockpit:

| Storage | What is stored | Encryption | Affected by encryption key / KDF changes? |
|---|---|---|---|
| `users.password` | Cockpit **login** passwords | passlib PBKDF2-SHA256 with a random per-user salt — self-contained in the hash | **No** |
| `credentials.password_encrypted` | Network device passwords, **Git/GitHub tokens**, API tokens | Fernet symmetric encryption, key derived from the credential encryption key | **Yes** |
| `credentials.ssh_key_encrypted` | SSH private keys | Fernet symmetric encryption, key derived from the credential encryption key | **Yes** |
| `credentials.ssh_passphrase_encrypted` | SSH key passphrases | Fernet symmetric encryption, key derived from the credential encryption key | **Yes** |
| `login_credentials.password_encrypted` | Shared login credentials for network devices | Fernet symmetric encryption, key derived from the credential encryption key | **Yes** |
| `snmp_mapping.snmp_v3_auth_password_encrypted` | SNMPv3 auth passwords | Fernet symmetric encryption, key derived from the credential encryption key | **Yes** |
| `snmp_mapping.snmp_v3_priv_password_encrypted` | SNMPv3 privacy passwords | Fernet symmetric encryption, key derived from the credential encryption key | **Yes** |

### The credential encryption key

The Fernet key is derived (PBKDF2-HMAC-SHA256) from **two inputs**, both of
which are part of the derived key — changing **either one** makes all stored
ciphertext unreadable until re-encrypted with `rotate_key.py`:

1. **The secret**, resolved in this order:
   - `CREDENTIAL_ENCRYPTION_KEY` env var (dedicated key, recommended — isolates
     stored credentials from a JWT `SECRET_KEY` compromise), otherwise
   - `SECRET_KEY` env var (backward-compatible fallback).
2. **The PBKDF2 iteration count**, from the `KDF_ITERATIONS` env var:
   - Default: `100000` (legacy value, non-breaking for existing installs).
   - Recommended (OWASP 2023): `600000` — adopt via the migration below.

Both variables must be **identical on every process** that touches encryption
(backend, Celery worker, Celery beat). The docker-compose setup passes them
through to all services.

**Consequence:** If you change `SECRET_KEY` (without a dedicated
`CREDENTIAL_ENCRYPTION_KEY`), `CREDENTIAL_ENCRYPTION_KEY`, or
`KDF_ITERATIONS`, users can still log in (their password hashes are
unaffected), but all stored network credentials become unreadable until you
re-encrypt them with `rotate_key.py`.

---

## Understanding the `--username` Filter in `rotate_key.py`

The `--username` parameter refers to the **owner** of a stored credential — the
Cockpit username that was set as the credential's owner when it was created.
It is **not** the device username or the GitHub username stored inside the
credential itself.

Cockpit stores two kinds of credentials:

| Kind | `source` field | `owner` field | Who sees it |
|---|---|---|---|
| **General / shared** | `general` | `NULL` | All users (e.g. shared Git tokens, team SSH keys) |
| **Private** | `private` | `"alice"` | Only the owning user |

When you pass `--username alice`, `rotate_key.py` only re-encrypts rows where
`owner = 'alice'`.  General credentials (owner `NULL`) are **skipped**, and so
are the `login_credentials` and `snmp_mapping` tables (they have no owner
field).

For a complete key rotation you should **always run without `--username`**.

---

## Script A — `rotate_key.py`

Re-encrypts all stored network credentials (`credentials`,
`login_credentials`, and `snmp_mapping` tables) from an old encryption key to
a new one.  Supports rotating the **key source** (e.g. `SECRET_KEY` →
`CREDENTIAL_ENCRYPTION_KEY`) and/or the **PBKDF2 iteration count** (legacy
`100000` → recommended `600000`) in a single pass — including a same-key,
iterations-only migration.

### Usage

```
python scripts/credential_manager/rotate_key.py \
    --old-key OLD_SECRET \
   [--new-key NEW_SECRET] \
   [--old-iterations N] \
   [--new-iterations N] \
   [--username USERNAME] \
   [--dry-run] \
   [--yes]
```

### Parameters

| Parameter | Required | Description |
|---|---|---|
| `--old-key` | **Yes** | The secret that was used when the credentials were originally encrypted (usually the current `SECRET_KEY`). |
| `--new-key` | No | The new secret to encrypt with.  Defaults to `CREDENTIAL_ENCRYPTION_KEY` from `.env` / environment, then `SECRET_KEY`. |
| `--old-iterations` | No | PBKDF2 iterations used to encrypt the existing data.  Default: `100000` (the legacy value).  If your install already runs with a custom `KDF_ITERATIONS`, pass that value here. |
| `--new-iterations` | No | PBKDF2 iterations for re-encryption.  Default: `600000` (OWASP 2023 recommendation).  **Deliberately independent of the `KDF_ITERATIONS` env var** so the script always defaults to migrating forward. |
| `--username` | No | Only re-encrypt credentials whose **owner** field equals this Cockpit username.  When set, the `login_credentials` and `snmp_mapping` tables are skipped (they have no owner field).  **Omit for a full rotation.** |
| `--dry-run` | No | Print what would be changed without writing anything to the database. |
| `--yes` | No | Skip the confirmation prompt (useful in automation). |

> The old and new key may be identical as long as the iteration counts differ
> (iterations-only migration).  The script refuses to run only when key **and**
> iterations are both unchanged.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — all rows processed or nothing to do. |
| `1` | Fatal error — exception thrown, all changes rolled back. |
| `2` | Partial failure — at least one row could not be decrypted with the old key and was skipped. |

---

### Migration 1 — Bump the KDF iterations only (100000 → 600000)

Use this when you keep the same secret but want to adopt the OWASP-recommended
iteration count.  This is the standard upgrade path for existing installs.

**Step 0 — Back up the database** (at minimum the `credentials`,
`login_credentials`, and `snmp_mapping` tables).  Keep the backup until the
smoke test passes.

**Step 1 — Stop the application** (backend, Celery worker, beat) to avoid
concurrent writes.

**Step 2 — Dry-run**

```bash
cd backend
python scripts/credential_manager/rotate_key.py \
    --old-key "$SECRET_KEY" \
    --dry-run
# --old-iterations 100000 and --new-iterations 600000 are the defaults
```

Confirm `processed > 0` and `failed == 0`.

**Step 3 — Run for real** (drop `--dry-run`, confirm with `y`).

**Step 4 — Set `KDF_ITERATIONS=600000`** in the environment of **every**
process (backend, Celery worker, beat) — e.g. in `backend/.env` or your
docker-compose environment.  The script prints this reminder after a
successful live run.

**Step 5 — Restart and smoke-test**: open a credential in the UI, run a
token-based git sync, or an SNMP compliance check, and confirm decryption
works.

---

### Migration 2 — Adopt a dedicated `CREDENTIAL_ENCRYPTION_KEY`

Use this to decouple credential encryption from the JWT `SECRET_KEY`.  Can be
combined with the iteration bump in one pass.

```bash
# Generate a new key
NEW_KEY=$(openssl rand -hex 32)

cd backend
python scripts/credential_manager/rotate_key.py \
    --old-key "$SECRET_KEY" \
    --new-key "$NEW_KEY" \
    --dry-run        # then run for real
```

Afterwards set **both** variables for every process and restart:

```bash
# backend/.env (or docker-compose environment)
CREDENTIAL_ENCRYPTION_KEY=<the generated key>
KDF_ITERATIONS=600000
```

`SECRET_KEY` stays unchanged, so JWT sessions are **not** invalidated.

---

### Migration 3 — Rotate the `SECRET_KEY` (classic key rotation)

Use this when `SECRET_KEY` itself must change and no dedicated
`CREDENTIAL_ENCRYPTION_KEY` is in use.

**Step 1 — Verify the old key is still in `.env`**

Do not change `SECRET_KEY` yet.  Confirm the currently running application
can still decrypt credentials (i.e. git syncs and device logins work).

**Step 2 — Do a dry-run to see what will be re-encrypted**

```bash
cd backend
python scripts/credential_manager/rotate_key.py \
    --old-key "current-secret-key" \
    --new-key "new-secret-key" \
    --dry-run
```

If your install still runs with the legacy iteration count and you want to
**keep** it (not recommended), add `--new-iterations 100000`; otherwise the
rotation also migrates to `600000` and you must set `KDF_ITERATIONS=600000`
afterwards (see Migration 1, Step 4).

Check the output.  Every credential row that will be touched is listed.

**Step 3 — Update `SECRET_KEY` in `.env`**

```bash
# backend/.env
SECRET_KEY=new-secret-key
```

**Step 4 — Run the rotation**

```bash
cd backend
python scripts/credential_manager/rotate_key.py \
    --old-key "current-secret-key"
    # --new-key is not needed: it now reads the new value from .env
```

Confirm with `y` when prompted.

**Step 5 — Set `KDF_ITERATIONS` (if migrated) and restart the backend**

```bash
python start.py
```

The application now signs new JWT tokens and decrypts credentials with the new
key.  Existing browser sessions will be invalidated (users must log in again).

---

### Rollback

Re-encryption is reversible: run the script again with the keys and iteration
counts swapped (e.g. `--old-iterations 600000 --new-iterations 100000`), or
restore the pre-migration database backup.  Code and data must always agree:
reverting the environment variables without re-running the rotation (or vice
versa) breaks decryption.

---

### How to re-encrypt only one user's private credentials

Use this if you are rotating credentials for a single user without touching
shared/general credentials.

```bash
cd backend
python scripts/credential_manager/rotate_key.py \
    --old-key "old-secret-key" \
    --username alice
```

Only rows in `credentials` where `owner = 'alice'` are processed.
General credentials, `login_credentials`, and `snmp_mapping` are left
untouched.

> **Warning:** Do **not** combine `--username` with a key or iteration change
> you intend to keep — the skipped rows would remain encrypted with the old
> parameters and become unreadable once the environment is switched.  Use this
> only when old and new parameters coexist deliberately.

---

### Where to find a credential's owner

In the Cockpit UI, go to **Settings → Credentials**.  Private credentials show
the owning username.  General credentials show no owner.

In the database:
```sql
SELECT id, name, type, source, owner FROM credentials ORDER BY source, owner;
```

---

## Script B — `set_password.py`

Sets a new Cockpit **login** password for a named user directly in the database.

Use this when:
- A user is locked out and cannot reset their own password.
- You need to set the initial admin password without the web UI.

> **Note:** This script changes login passwords only.  It has no effect on
> stored network credentials and does not require a `SECRET_KEY` change.

### Usage

```
python scripts/credential_manager/set_password.py \
    --username USERNAME \
   [--password PASSWORD]
```

### Parameters

| Parameter | Required | Description |
|---|---|---|
| `--username` | **Yes** | The Cockpit username whose login password will be updated. |
| `--password` | No | New plaintext password.  If omitted, you will be prompted twice interactively (input is hidden). |

### Minimum password length

8 characters.

### Example — interactive prompt (recommended)

```bash
cd backend
python scripts/credential_manager/set_password.py --username admin
# New password: ········
# Confirm password: ········
# Password updated successfully for 'admin'.
```

### Example — password passed as argument

```bash
cd backend
python scripts/credential_manager/set_password.py \
    --username alice \
    --password "correct-horse-battery-staple"
```

> **Warning:** Passing a password on the command line may expose it in shell
> history.  Prefer the interactive prompt in production.
