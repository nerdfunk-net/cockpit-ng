"""Unit tests for services/checkmk/sync/base.py backward-compat re-exports."""

from __future__ import annotations

import pytest

from services.checkmk.sync import NautobotToCheckMKService as FacadeService
from services.checkmk.sync.base import NautobotToCheckMKService


@pytest.mark.unit
def test_base_reexports_nautobot_to_checkmk_service() -> None:
    assert NautobotToCheckMKService is FacadeService
