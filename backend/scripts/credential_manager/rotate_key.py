#!/usr/bin/env python3
"""Re-encrypt stored credentials from an old SECRET_KEY to a new one.

Usage:
    python rotate_key.py --old-key OLD_SECRET [--new-key NEW_SECRET] \\
        [--username USERNAME] [--dry-run] [--yes]

NOTE: Login passwords in the `users` table use passlib PBKDF2-SHA256 with a
random per-user salt embedded in the hash.  They are NOT affected by SECRET_KEY
changes and require no action.

Only network credentials stored in:
  - credentials          (password_encrypted, ssh_key_encrypted, ssh_passphrase_encrypted)
  - login_credentials    (password_encrypted)
need to be re-encrypted when SECRET_KEY changes.
"""

from __future__ import annotations

import sys
import argparse
import logging
from pathlib import Path

# ---------------------------------------------------------------------------
# Add backend root to sys.path so all backend modules resolve correctly
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from credentials_manager import EncryptionService  # noqa: E402
from core.database import get_db_session  # noqa: E402
from core.models import Credential, LoginCredential  # noqa: E402
from config import settings  # noqa: E402

logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CREDENTIAL_ENCRYPTED_FIELDS = (
    "password_encrypted",
    "ssh_key_encrypted",
    "ssh_passphrase_encrypted",
)


def _rotate_credentials(
    db,
    old_enc: EncryptionService,
    new_enc: EncryptionService,
    username_filter: str | None,
    dry_run: bool,
) -> dict:
    """Re-encrypt all rows in the ``credentials`` table.

    Returns a dict with counts: processed, skipped, failed.
    """
    query = db.query(Credential)
    if username_filter:
        query = query.filter(Credential.owner == username_filter)

    rows = query.all()
    processed = skipped = failed = 0

    for row in rows:
        row_changed = False
        row_failed = False

        for field in _CREDENTIAL_ENCRYPTED_FIELDS:
            raw: bytes | None = getattr(row, field)
            if raw is None:
                continue

            try:
                plaintext = old_enc.decrypt(raw)
            except Exception as exc:
                print(
                    f"  WARNING: credentials id={row.id} field={field}: "
                    f"{exc} — skipping field"
                )
                row_failed = True
                failed += 1
                continue

            if not dry_run:
                setattr(row, field, new_enc.encrypt(plaintext))
            row_changed = True

        if row_failed:
            # Already counted per-field; don't double-count as processed
            continue

        if row_changed:
            tag = "[DRY-RUN] " if dry_run else ""
            print(
                f"  {tag}credentials id={row.id} name={row.name!r} "
                f"owner={row.owner!r}"
            )
            processed += 1
        else:
            skipped += 1

    return {"processed": processed, "skipped": skipped, "failed": failed}


def _rotate_login_credentials(
    db,
    old_enc: EncryptionService,
    new_enc: EncryptionService,
    dry_run: bool,
) -> dict:
    """Re-encrypt all rows in the ``login_credentials`` table.

    Returns a dict with counts: processed, skipped, failed.
    """
    rows = db.query(LoginCredential).all()
    processed = skipped = failed = 0

    for row in rows:
        raw: bytes | None = row.password_encrypted
        if raw is None:
            skipped += 1
            continue

        try:
            plaintext = old_enc.decrypt(raw)
        except Exception as exc:
            print(
                f"  WARNING: login_credentials id={row.id}: "
                f"{exc} — skipping row"
            )
            failed += 1
            continue

        if not dry_run:
            row.password_encrypted = new_enc.encrypt(plaintext)

        tag = "[DRY-RUN] " if dry_run else ""
        print(
            f"  {tag}login_credentials id={row.id} name={row.name!r}"
        )
        processed += 1

    return {"processed": processed, "skipped": skipped, "failed": failed}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Re-encrypt stored network credentials from an old SECRET_KEY "
            "to a new one."
        )
    )
    parser.add_argument(
        "--old-key",
        required=True,
        help="The old SECRET_KEY used to encrypt existing credentials.",
    )
    parser.add_argument(
        "--new-key",
        default=None,
        help=(
            "New SECRET_KEY (defaults to the value in .env / SECRET_KEY env var)."
        ),
    )
    parser.add_argument(
        "--username",
        default=None,
        help=(
            "Only re-encrypt credentials owned by this Cockpit user "
            "(Credential.owner field).  When set, login_credentials rows "
            "are skipped because they have no owner field."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without writing to the database.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation prompt and apply changes immediately.",
    )
    args = parser.parse_args()

    old_key: str = args.old_key
    new_key: str = args.new_key or settings.secret_key

    if not new_key:
        print(
            "ERROR: new key could not be determined.  "
            "Set SECRET_KEY in .env or pass --new-key."
        )
        sys.exit(1)

    if old_key == new_key:
        print("ERROR: --old-key and the new key are identical — nothing to do.")
        sys.exit(1)

    old_enc = EncryptionService(secret_key=old_key)
    new_enc = EncryptionService(secret_key=new_key)

    print("=" * 60)
    print("Credential Key Rotation")
    print("=" * 60)
    print(f"  Tables:  credentials, login_credentials")
    filter_desc = f"owner={args.username!r}" if args.username else "all rows"
    print(f"  Filter:  {filter_desc}")
    mode_desc = "DRY-RUN (no changes will be written)" if args.dry_run else "LIVE"
    print(f"  Mode:    {mode_desc}")
    print()
    print(
        "NOTE: Login passwords in the `users` table use passlib PBKDF2-SHA256\n"
        "      with a random per-user salt. They are NOT affected by SECRET_KEY\n"
        "      changes and require no action here.\n"
    )

    if not args.dry_run and not args.yes:
        try:
            answer = input("Apply changes to the database? [y/N] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nAborted.")
            sys.exit(0)
        if answer not in ("y", "yes"):
            print("Aborted.")
            sys.exit(0)

    db = get_db_session()
    try:
        print("Processing credentials table ...")
        cred_stats = _rotate_credentials(
            db, old_enc, new_enc, args.username, args.dry_run
        )

        if not args.username:
            print("\nProcessing login_credentials table ...")
            login_stats = _rotate_login_credentials(db, old_enc, new_enc, args.dry_run)
        else:
            print(
                "\nSkipping login_credentials table "
                "(no owner field — run without --username to process all rows)."
            )
            login_stats = {"processed": 0, "skipped": 0, "failed": 0}

        if not args.dry_run:
            db.commit()
            print("\nChanges committed successfully.")
        else:
            print("\n[DRY-RUN] No changes were written to the database.")

        total_processed = cred_stats["processed"] + login_stats["processed"]
        total_skipped = cred_stats["skipped"] + login_stats["skipped"]
        total_failed = cred_stats["failed"] + login_stats["failed"]

        print()
        print("Summary:")
        print(
            f"  credentials:       "
            f"processed={cred_stats['processed']}, "
            f"skipped={cred_stats['skipped']}, "
            f"failed={cred_stats['failed']}"
        )
        print(
            f"  login_credentials: "
            f"processed={login_stats['processed']}, "
            f"skipped={login_stats['skipped']}, "
            f"failed={login_stats['failed']}"
        )
        print(
            f"  TOTAL:             "
            f"processed={total_processed}, "
            f"skipped={total_skipped}, "
            f"failed={total_failed}"
        )

        if total_failed > 0:
            print(
                f"\nWARNING: {total_failed} row(s) could not be decrypted with "
                "the old key and were skipped."
            )
            sys.exit(2)

    except Exception as exc:
        db.rollback()
        print(f"\nERROR: {exc}")
        print("All changes rolled back.")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
