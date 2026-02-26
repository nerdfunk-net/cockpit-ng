# Credential Manager Scripts

Maintenance scripts for Cockpit credential storage.  Run all commands from the
**`backend/`** directory so that the Python path and `.env` file are resolved
correctly.

---

## Background: What Does `SECRET_KEY` Encrypt?

There are two completely separate authentication mechanisms in Cockpit:

| Storage | What is stored | Encryption | Affected by `SECRET_KEY`? |
|---|---|---|---|
| `users.password` | Cockpit **login** passwords | passlib PBKDF2-SHA256 with a random per-user salt — self-contained in the hash | **No** |
| `credentials.password_encrypted` | Network device passwords, **Git/GitHub tokens**, API tokens | Fernet symmetric encryption, key derived from `SECRET_KEY` | **Yes** |
| `credentials.ssh_key_encrypted` | SSH private keys | Fernet symmetric encryption, key derived from `SECRET_KEY` | **Yes** |
| `credentials.ssh_passphrase_encrypted` | SSH key passphrases | Fernet symmetric encryption, key derived from `SECRET_KEY` | **Yes** |
| `login_credentials.password_encrypted` | Shared login credentials for network devices | Fernet symmetric encryption, key derived from `SECRET_KEY` | **Yes** |

**Consequence:** If you change `SECRET_KEY` in `.env`, users can still log in
(their password hashes are unaffected), but all stored network credentials
become unreadable until you re-encrypt them with `rotate_key.py`.

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
`owner = 'alice'`.  General credentials (owner `NULL`) are **skipped**.

For a complete key rotation you should **always run without `--username`**.

---

## Script A — `rotate_key.py`

Re-encrypts all stored network credentials from an old `SECRET_KEY` to a new
one.

### Usage

```
python scripts/credential_manager/rotate_key.py \
    --old-key OLD_SECRET \
   [--new-key NEW_SECRET] \
   [--username USERNAME] \
   [--dry-run] \
   [--yes]
```

### Parameters

| Parameter | Required | Description |
|---|---|---|
| `--old-key` | **Yes** | The `SECRET_KEY` value that was used when the credentials were originally encrypted. |
| `--new-key` | No | The new `SECRET_KEY` to encrypt with.  Defaults to the value of `SECRET_KEY` in `.env`. |
| `--username` | No | Only re-encrypt credentials whose **owner** field equals this Cockpit username.  When set, the `login_credentials` table is skipped (it has no owner field).  **Omit for a full rotation.** |
| `--dry-run` | No | Print what would be changed without writing anything to the database. |
| `--yes` | No | Skip the confirmation prompt (useful in automation). |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — all rows processed or nothing to do. |
| `1` | Fatal error — exception thrown, all changes rolled back. |
| `2` | Partial failure — at least one row could not be decrypted with the old key and was skipped. |

---

### How to perform a full key rotation

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

**Step 5 — Restart the backend**

```bash
python start.py
```

The application now signs new JWT tokens and decrypts credentials with the new
key.  Existing browser sessions will be invalidated (users must log in again).

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
General credentials and `login_credentials` are left untouched.

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
