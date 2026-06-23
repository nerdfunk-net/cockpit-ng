"""Unit tests for services/nautobot/ip_addresses/ip_address_query_service.py."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_PATCH_SF = "service_factory.build_nautobot_service"


def _make_svc(graphql_result=None, rest_exc=None):
    nb = MagicMock()
    nb.graphql_query = AsyncMock(
        return_value=graphql_result or {"data": {"ip_addresses": []}}
    )
    if rest_exc:
        nb.rest_request = AsyncMock(side_effect=rest_exc)
    else:
        nb.rest_request = AsyncMock(return_value=None)

    with patch(_PATCH_SF, return_value=nb):
        from services.nautobot.ip_addresses.ip_address_query_service import (
            IPAddressQueryService,
        )

        svc = IPAddressQueryService()
    return svc, nb


@pytest.mark.unit
class TestResolveDateTemplate:
    def test_today_placeholder_replaced(self):
        from services.nautobot.ip_addresses.ip_address_query_service import (
            _resolve_date_template,
        )

        result = _resolve_date_template("{today}")
        assert result == date.today().isoformat()

    def test_today_minus_offset(self):
        from services.nautobot.ip_addresses.ip_address_query_service import (
            _resolve_date_template,
        )

        expected = (
            date.today() - __import__("datetime").timedelta(days=14)
        ).isoformat()
        assert _resolve_date_template("{today-14}") == expected

    def test_today_plus_offset(self):
        from services.nautobot.ip_addresses.ip_address_query_service import (
            _resolve_date_template,
        )

        expected = (date.today() + __import__("datetime").timedelta(days=7)).isoformat()
        assert _resolve_date_template("{today+7}") == expected

    def test_literal_string_unchanged(self):
        from services.nautobot.ip_addresses.ip_address_query_service import (
            _resolve_date_template,
        )

        assert _resolve_date_template("2026-01-01") == "2026-01-01"

    def test_mixed_template_and_literal(self):
        from services.nautobot.ip_addresses.ip_address_query_service import (
            _resolve_date_template,
        )

        result = _resolve_date_template("scan-{today}")
        assert result == f"scan-{date.today().isoformat()}"


@pytest.mark.unit
class TestBuildFilterKey:
    def test_with_filter_type(self):
        svc, _ = _make_svc()
        assert svc._build_filter_key("cf_last_scan", "lte") == "cf_last_scan__lte"

    def test_without_filter_type(self):
        svc, _ = _make_svc()
        assert svc._build_filter_key("cf_last_scan", None) == "cf_last_scan"


@pytest.mark.unit
class TestBuildSelectionFields:
    def test_custom_field_returns_itself(self):
        svc, _ = _make_svc()
        assert svc._build_selection_fields("cf_last_scan") == "cf_last_scan"

    def test_regular_field_returns_empty(self):
        svc, _ = _make_svc()
        assert svc._build_selection_fields("address") == ""


@pytest.mark.unit
class TestRunGraphql:
    def test_returns_ip_addresses_list(self):
        ips = [{"id": "ip-1", "address": "10.0.0.1/24"}]
        svc, _ = _make_svc({"data": {"ip_addresses": ips}})
        result = svc._run_graphql("{ip_addresses { id address }}", "test query")
        assert result == ips

    def test_returns_empty_on_exception(self):
        svc, nb = _make_svc()
        nb.graphql_query = AsyncMock(side_effect=RuntimeError("boom"))
        result = svc._run_graphql("{}", "failing query")
        assert result == []

    def test_returns_empty_on_missing_data(self):
        svc, nb = _make_svc({})
        result = svc._run_graphql("{}", "no data")
        assert result == []


@pytest.mark.unit
class TestListIpAddresses:
    def _ip(self, id: str, addr: str, cf_val=None) -> dict:
        return {"id": id, "address": addr, "cf_last_scan": cf_val}

    def test_returns_ips_matching_filter(self):
        ips = [self._ip("ip-1", "10.0.0.1/24", "2026-01-01")]
        svc, nb = _make_svc({"data": {"ip_addresses": ips}})
        result = svc.list_ip_addresses("cf_last_scan", "2026-01-01")
        assert len(result) == 1

    def test_excludes_null_field_values_by_default(self):
        ips = [
            self._ip("ip-1", "10.0.0.1/24", "2026-01-01"),
            self._ip("ip-2", "10.0.0.2/24", None),
        ]
        svc, nb = _make_svc({"data": {"ip_addresses": ips}})
        result = svc.list_ip_addresses("cf_last_scan", "2026-01-01")
        assert len(result) == 1
        assert result[0]["id"] == "ip-1"

    def test_include_null_merges_secondary_query(self):
        primary_ips = [self._ip("ip-1", "10.0.0.1/24", "2026-01-01")]
        null_ips = [self._ip("ip-2", "10.0.0.2/24", None)]
        call_count = 0

        async def _graphql(query):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {"data": {"ip_addresses": primary_ips}}
            return {"data": {"ip_addresses": null_ips}}

        svc, nb = _make_svc()
        nb.graphql_query = AsyncMock(side_effect=_graphql)
        result = svc.list_ip_addresses("cf_last_scan", "2026-01-01", include_null=True)
        assert len(result) == 2

    def test_include_null_deduplicates(self):
        ip = self._ip("ip-1", "10.0.0.1/24", "2026-01-01")
        call_count = 0

        async def _graphql(query):
            nonlocal call_count
            call_count += 1
            return {"data": {"ip_addresses": [ip]}}

        svc, nb = _make_svc()
        nb.graphql_query = AsyncMock(side_effect=_graphql)
        result = svc.list_ip_addresses("cf_last_scan", "2026-01-01", include_null=True)
        assert len(result) == 1


@pytest.mark.unit
class TestUpdateIpAddress:
    def test_returns_true_on_success(self):
        svc, _ = _make_svc()
        assert svc.update_ip_address("ip-uuid", status_id="status-id") is True

    def test_returns_true_with_nothing_to_update(self):
        svc, _ = _make_svc()
        assert svc.update_ip_address("ip-uuid") is True

    def test_returns_false_on_exception(self):
        svc, nb = _make_svc(rest_exc=RuntimeError("api error"))
        assert svc.update_ip_address("ip-uuid", status_id="x") is False

    def test_builds_patch_with_status_tag_description(self):
        svc, nb = _make_svc()
        svc.update_ip_address(
            "ip-uuid",
            status_id="status-id",
            tag_id="tag-id",
            description="test",
        )
        nb.rest_request.assert_called_once()


@pytest.mark.unit
class TestDeleteIpAddress:
    def test_returns_true_on_success(self):
        svc, _ = _make_svc()
        assert svc.delete_ip_address("ip-uuid") is True

    def test_returns_false_on_exception(self):
        svc, nb = _make_svc(rest_exc=RuntimeError("not found"))
        assert svc.delete_ip_address("ip-uuid") is False


@pytest.mark.unit
class TestDeleteIpAddressesByFilter:
    def test_deletes_all_matching(self):
        ips = [
            {"id": "ip-1", "address": "10.0.0.1/24", "cf_last_scan": "2026-01-01"},
            {"id": "ip-2", "address": "10.0.0.2/24", "cf_last_scan": "2026-01-01"},
        ]
        svc, nb = _make_svc({"data": {"ip_addresses": ips}})
        result = svc.delete_ip_addresses_by_filter("cf_last_scan", "2026-01-01")
        assert result["total"] == 2
        assert result["deleted"] == 2
        assert result["failed"] == 0

    def test_counts_failed_when_delete_fails(self):
        ips = [{"id": "ip-1", "address": "10.0.0.1/24", "cf_last_scan": "2026-01-01"}]
        svc, nb = _make_svc({"data": {"ip_addresses": ips}})
        nb.rest_request = AsyncMock(side_effect=RuntimeError("403"))
        result = svc.delete_ip_addresses_by_filter("cf_last_scan", "2026-01-01")
        assert result["failed"] == 1

    def test_counts_failed_for_missing_id(self):
        # IP has the filter field present (so it passes null-filter) but no 'id' field
        ips = [{"address": "10.0.0.1/24", "cf_last_scan": "2026-01-01"}]
        svc, _ = _make_svc({"data": {"ip_addresses": ips}})
        result = svc.delete_ip_addresses_by_filter("cf_last_scan", "2026-01-01")
        assert result["failed"] == 1
        assert result["deleted"] == 0
