"""Shared helpers for mapping Nautobot REST API errors to HTTP responses."""

from __future__ import annotations

import json
import re
from typing import Any

_REST_STATUS_JSON_RE = re.compile(r"status \d+:\s*(\{.*\})\s*$", re.DOTALL)


def _humanize_field_error(field: str, message: str) -> str:
    """Turn Nautobot validation errors into user-facing messages."""
    if field == "__all__":
        return message

    label = field.replace("_", " ").strip().title()
    if "Related object not found" in message:
        return (
            f"{label}: The selected {label.lower()} was not found in Nautobot. "
            "Check Server Defaults or pick a valid value in Nautobot."
        )
    return f"{label}: {message}"


def _messages_from_nautobot_json(body: dict[str, Any]) -> list[str]:
    messages: list[str] = []
    for field, field_errors in body.items():
        if isinstance(field_errors, list):
            for item in field_errors:
                messages.append(_humanize_field_error(field, str(item)))
        else:
            messages.append(_humanize_field_error(field, str(field_errors)))
    return messages


def extract_nautobot_error_detail(error_msg: str) -> str:
    """Extract a human-readable message from a NautobotAPIError string.

    Nautobot REST errors look like:
      'REST request failed with status 400: {"__all__":["..."]}'
    or wrapped by managers:
      'Failed to create virtual machine: REST request failed with status 400: {...}'
    or the ip_manager wraps them with a nicer message like:
      'Cannot create IP address ...: No suitable parent prefix exists.'
    """
    match = _REST_STATUS_JSON_RE.search(error_msg)
    if match:
        try:
            body = json.loads(match.group(1))
            if isinstance(body, dict):
                messages = _messages_from_nautobot_json(body)
                if messages:
                    return "; ".join(messages)
        except (json.JSONDecodeError, TypeError, AttributeError):
            pass

    if error_msg.startswith("REST request failed"):
        return error_msg

    return error_msg
