# CheckMK Exception to Status Mapping

Purpose: preserve existing endpoint behavior during router/service split.

Instructions:
- Do not collapse all service exceptions into generic 400/500.
- For each endpoint, define explicit mappings for known failure modes.
- Keep detail payload shape compatible with existing responses.

## Global Mapping Rules

| Source exception/failure | HTTP status | Notes |
|--------------------------|-------------|-------|
| HostNotFoundError | 404 | Keep existing not-found paths unchanged |
| CheckMKAPIError (code 428) | 428 | Required for host/folder move precondition behavior |
| Upstream request/transport failure | 502 | Preserve existing bad-gateway behavior |
| Availability/readiness failure | 503 | Preserve existing service-unavailable behavior |
| Settings/config validation error | 400 | Keep as client error |
| Unhandled runtime error | 500 | Log with context, preserve generic failure envelope |

## Endpoint-Level Mapping Matrix

Fill one row per endpoint, then reference this key from endpoint-mapping.md.

| Mapping Key | Method | Path | Known Failure Case | Exception Type | Status | Detail Strategy |
|-------------|--------|------|--------------------|----------------|--------|-----------------|
| connection.test | POST | /api/checkmk/test | invalid settings | CheckMKClientError | 400 | str(exception) |
| connection.stats | GET | /api/checkmk/stats | checkmk unavailable | Exception/availability branch | 503 | preserve existing message |
| hosts.get | GET | /api/checkmk/hosts/{hostname} | host missing | HostNotFoundError | 404 | preserve existing detail text |
| hosts.move | POST | /api/checkmk/hosts/{hostname}/move | precondition required | CheckMKAPIError(code=428) | 428 | preserve existing detail text |
| folders.get | GET | /api/checkmk/folders/{folder_path} | upstream API error | upstream exception | 502 | preserve existing detail text |

## Validation Checklist

- [ ] All endpoint keys in endpoint-mapping.md reference a mapping key in this file.
- [ ] 404 behavior preserved for all not-found paths.
- [ ] 428 behavior preserved for move operations.
- [ ] 502/503 branches preserved where currently implemented.
- [ ] No endpoint regressed to unconditional 400/500 fallback.

## Endpoint Mapping Keys (Auto-Extracted)

Use these keys from endpoint-mapping.md and fill endpoint-specific failure behavior.

| Mapping Key | Method | Path | Known Failure Case | Exception Type | Status | Detail Strategy |
|-------------|--------|------|--------------------|----------------|--------|-----------------|
| connection.test_checkmk_connection | POST | /api/checkmk/test | TBD | TBD | TBD | TBD |
| connection.test_current_checkmk_connection | GET | /api/checkmk/test | TBD | TBD | TBD | TBD |
| connection.get_checkmk_stats | GET | /api/checkmk/stats | TBD | TBD | TBD | TBD |
| connection.get_version | GET | /api/checkmk/version | TBD | TBD | TBD | TBD |
| hosts.get_all_hosts | GET | /api/checkmk/hosts | TBD | TBD | TBD | TBD |
| hosts.get_host | GET | /api/checkmk/hosts/{hostname} | TBD | TBD | TBD | TBD |
| connection.get_host_inventory | GET | /api/checkmk/inventory/{hostname} | TBD | TBD | TBD | TBD |
| hosts.create_host | POST | /api/checkmk/hosts | TBD | TBD | TBD | TBD |
| hosts.create_host_v2 | POST | /api/checkmk/hosts/create | TBD | TBD | TBD | TBD |
| hosts.update_host | PUT | /api/checkmk/hosts/{hostname} | TBD | TBD | TBD | TBD |
| hosts.delete_host | DELETE | /api/checkmk/hosts/{hostname} | TBD | TBD | TBD | TBD |
| hosts.move_host | POST | /api/checkmk/hosts/{hostname}/move | TBD | TBD | TBD | TBD |
| hosts.rename_host | POST | /api/checkmk/hosts/{hostname}/rename | TBD | TBD | TBD | TBD |
| hosts.bulk_create_hosts | POST | /api/checkmk/hosts/bulk-create | TBD | TBD | TBD | TBD |
| hosts.bulk_update_hosts | POST | /api/checkmk/hosts/bulk-update | TBD | TBD | TBD | TBD |
| hosts.bulk_delete_hosts | POST | /api/checkmk/hosts/bulk-delete | TBD | TBD | TBD | TBD |
| monitoring.get_all_monitored_hosts | GET | /api/checkmk/monitoring/hosts | TBD | TBD | TBD | TBD |
| monitoring.get_monitored_host | GET | /api/checkmk/monitoring/hosts/{hostname} | TBD | TBD | TBD | TBD |
| hosts.get_host_services | GET | /api/checkmk/hosts/{hostname}/services | TBD | TBD | TBD | TBD |
| hosts.show_service | POST | /api/checkmk/hosts/{hostname}/services/{service}/show | TBD | TBD | TBD | TBD |
| discovery.get_service_discovery | GET | /api/checkmk/service-discovery/host/{hostname} | TBD | TBD | TBD | TBD |
| discovery.start_service_discovery | POST | /api/checkmk/service-discovery/host/{hostname}/start | TBD | TBD | TBD | TBD |
| discovery.wait_for_service_discovery | POST | /api/checkmk/service-discovery/host/{hostname}/wait | TBD | TBD | TBD | TBD |
| discovery.update_discovery_phase | POST | /api/checkmk/service-discovery/host/{hostname}/update-phase | TBD | TBD | TBD | TBD |
| discovery.start_bulk_discovery | POST | /api/checkmk/service-discovery/bulk | TBD | TBD | TBD | TBD |
| problems.acknowledge_host_problem | POST | /api/checkmk/acknowledge/host | TBD | TBD | TBD | TBD |
| problems.acknowledge_service_problem | POST | /api/checkmk/acknowledge/service | TBD | TBD | TBD | TBD |
| problems.delete_acknowledgment | DELETE | /api/checkmk/acknowledge/{ack_id} | TBD | TBD | TBD | TBD |
| problems.create_host_downtime | POST | /api/checkmk/downtime/host | TBD | TBD | TBD | TBD |
| problems.add_host_comment | POST | /api/checkmk/comments/host | TBD | TBD | TBD | TBD |
| problems.add_service_comment | POST | /api/checkmk/comments/service | TBD | TBD | TBD | TBD |
| activation.get_pending_changes | GET | /api/checkmk/changes/pending | TBD | TBD | TBD | TBD |
| activation.activate_changes | POST | /api/checkmk/changes/activate | TBD | TBD | TBD | TBD |
| activation.activate_changes_with_etag | POST | /api/checkmk/changes/activate/{etag} | TBD | TBD | TBD | TBD |
| activation.get_activation_status | GET | /api/checkmk/activation/{activation_id} | TBD | TBD | TBD | TBD |
| activation.wait_for_activation_completion | POST | /api/checkmk/activation/{activation_id}/wait | TBD | TBD | TBD | TBD |
| activation.get_running_activations | GET | /api/checkmk/activation/running | TBD | TBD | TBD | TBD |
| host-groups.get_host_groups | GET | /api/checkmk/host-groups | TBD | TBD | TBD | TBD |
| host-groups.get_host_group | GET | /api/checkmk/host-groups/{group_name} | TBD | TBD | TBD | TBD |
| host-groups.create_host_group | POST | /api/checkmk/host-groups | TBD | TBD | TBD | TBD |
| host-groups.update_host_group | PUT | /api/checkmk/host-groups/{name} | TBD | TBD | TBD | TBD |
| host-groups.delete_host_group | DELETE | /api/checkmk/host-groups/{name} | TBD | TBD | TBD | TBD |
| host-groups.bulk_update_host_groups | PUT | /api/checkmk/host-groups/bulk-update | TBD | TBD | TBD | TBD |
| host-groups.bulk_delete_host_groups | DELETE | /api/checkmk/host-groups/bulk-delete | TBD | TBD | TBD | TBD |
| folders.get_all_folders | GET | /api/checkmk/folders | TBD | TBD | TBD | TBD |
| folders.get_folder | GET | /api/checkmk/folders/{folder_path} | TBD | TBD | TBD | TBD |
| folders.create_folder | POST | /api/checkmk/folders | TBD | TBD | TBD | TBD |
| folders.update_folder | PUT | /api/checkmk/folders/{folder_path} | TBD | TBD | TBD | TBD |
| folders.delete_folder | DELETE | /api/checkmk/folders/{folder_path} | TBD | TBD | TBD | TBD |
| folders.move_folder | POST | /api/checkmk/folders/{folder_path}/move | TBD | TBD | TBD | TBD |
| folders.bulk_update_folders | PUT | /api/checkmk/folders/bulk-update | TBD | TBD | TBD | TBD |
| folders.get_hosts_in_folder | GET | /api/checkmk/folders/{folder_path}/hosts | TBD | TBD | TBD | TBD |
| tag-groups.get_all_host_tag_groups | GET | /api/checkmk/host-tag-groups | TBD | TBD | TBD | TBD |
| tag-groups.get_host_tag_group | GET | /api/checkmk/host-tag-groups/{name} | TBD | TBD | TBD | TBD |
| tag-groups.create_host_tag_group | POST | /api/checkmk/host-tag-groups | TBD | TBD | TBD | TBD |
| tag-groups.update_host_tag_group | PUT | /api/checkmk/host-tag-groups/{name} | TBD | TBD | TBD | TBD |
| tag-groups.delete_host_tag_group | DELETE | /api/checkmk/host-tag-groups/{name} | TBD | TBD | TBD | TBD |
