"""Shared helpers for mapping Nautobot REST API errors to HTTP responses."""

from __future__ import annotations

import json
import re


def extract_nautobot_error_detail(error_msg: str) -> str:
    """Extract a human-readable message from a NautobotAPIError string.

    Nautobot REST errors look like:
      'REST request failed with status 400: {"__all__":["..."]}'
    or the ip_manager wraps them with a nicer message like:
      'Cannot create IP address ...: No suitable parent prefix exists.'
    """
    if not error_msg.startswith("REST request failed"):
        return error_msg

    match = re.search(r"status \d+: (.+)$", error_msg)
    if match:
        try:
            body = json.loads(match.group(1))
            messages = []
            for field_errors in body.values():
                if isinstance(field_errors, list):
                    messages.extend(field_errors)
                else:
                    messages.append(str(field_errors))
            if messages:
                return "; ".join(messages)
        except (json.JSONDecodeError, AttributeError):
            pass

    return error_msg
