"""Load and merge baseline generation profiles from data/baseline/profiles/."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from models.tools import BaselineProfileSummary, CreateBaselineRequest

BACKEND_ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = BACKEND_ROOT.parent
PROFILES_DIR = REPO_ROOT / "data" / "baseline" / "profiles"


def _profile_path(profile_id: str) -> Path:
    path = PROFILES_DIR / f"{profile_id}.json"
    if not path.is_file():
        raise ValueError(f"Unknown baseline profile: {profile_id}")
    return path


def load_profile(profile_id: str) -> dict[str, Any]:
    with _profile_path(profile_id).open(encoding="utf-8") as handle:
        return json.load(handle)


def list_profiles() -> list[BaselineProfileSummary]:
    summaries: list[BaselineProfileSummary] = []
    if not PROFILES_DIR.is_dir():
        return summaries
    for path in sorted(PROFILES_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        summaries.append(
            BaselineProfileSummary(
                id=data["id"],
                label=data.get("label", data["id"]),
                description=data.get("description", ""),
            )
        )
    return summaries


def merge_profile_into_request(request: CreateBaselineRequest) -> CreateBaselineRequest:
    """Apply profile defaults when request.profile is set."""
    if not request.profile:
        return request

    from models.tools import DistributionConfig

    profile = load_profile(request.profile)
    profile_request = dict(profile.get("request", {}))
    profile_request.pop("profile", None)

    merged: dict[str, Any] = {**profile_request, **request.model_dump(exclude_unset=True)}
    merged["profile"] = request.profile

    if request.distribution is not None:
        merged["distribution"] = request.distribution
    elif profile_request.get("distribution"):
        merged["distribution"] = DistributionConfig(**profile_request["distribution"])

    return CreateBaselineRequest(**merged)


def profile_output_dir(profile_id: str) -> Path | None:
    profile = load_profile(profile_id)
    suggested = profile.get("output", {}).get("suggested_import_dir")
    if not suggested:
        return None
    return (REPO_ROOT / suggested).resolve()
