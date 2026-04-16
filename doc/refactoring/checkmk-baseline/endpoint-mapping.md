# CheckMK Endpoint Mapping Matrix

Purpose: prove parity between the monolith router and split domain routers.

Instructions:
- Keep method/path, permission, response model, and status behavior identical.
- Validate each row against routes.txt, permissions.txt, response-models.txt, and status-codes.txt.
- Attach one test ID per row.

## Coverage Status

- Source routes detected in main.py: 57 (from endpoint-details.tsv)
- Rows prefilled below: 57
- Rows requiring response-model confirmation: 2 (implicit models)

## Mapping Table

| Domain | Method | Path | Old handler | New router | New service method | Permission | Response model | Status mapping reference | Test ID |
|--------|--------|------|-------------|------------|--------------------|------------|----------------|--------------------------|---------|
| connection | POST | /api/checkmk/test | test_checkmk_connection | connection.py | CheckMKConnectionService.test_checkmk_connection | checkmk.devices:write | CheckMKTestConnectionResponse | connection.test_checkmk_connection | CHK-001 |
| connection | GET | /api/checkmk/test | test_current_checkmk_connection | connection.py | CheckMKConnectionService.test_current_checkmk_connection | checkmk.devices:write | None (implicit) | connection.test_current_checkmk_connection | CHK-002 |
| connection | GET | /api/checkmk/stats | get_checkmk_stats | connection.py | CheckMKConnectionService.get_checkmk_stats | checkmk.devices:read | None (implicit) | connection.get_checkmk_stats | CHK-003 |
| connection | GET | /api/checkmk/version | get_version | connection.py | CheckMKConnectionService.get_version | checkmk.devices:read | CheckMKVersionResponse | connection.get_version | CHK-004 |
| hosts | GET | /api/checkmk/hosts | get_all_hosts | hosts.py | CheckMKHostService.get_all_hosts | checkmk.devices:write | CheckMKHostListResponse | hosts.get_all_hosts | CHK-005 |
| hosts | GET | /api/checkmk/hosts/{hostname} | get_host | hosts.py | CheckMKHostService.get_host | checkmk.devices:write | CheckMKOperationResponse | hosts.get_host | CHK-006 |
| connection | GET | /api/checkmk/inventory/{hostname} | get_host_inventory | connection.py | CheckMKConnectionService.get_host_inventory | checkmk.devices:read | CheckMKOperationResponse | connection.get_host_inventory | CHK-007 |
| hosts | POST | /api/checkmk/hosts | create_host | hosts.py | CheckMKHostService.create_host | checkmk.devices:write | CheckMKOperationResponse | hosts.create_host | CHK-008 |
| hosts | POST | /api/checkmk/hosts/create | create_host_v2 | hosts.py | CheckMKHostService.create_host_v2 | checkmk.devices:write | CheckMKOperationResponse | hosts.create_host_v2 | CHK-009 |
| hosts | PUT | /api/checkmk/hosts/{hostname} | update_host | hosts.py | CheckMKHostService.update_host | checkmk.devices:write | CheckMKOperationResponse | hosts.update_host | CHK-010 |
| hosts | DELETE | /api/checkmk/hosts/{hostname} | delete_host | hosts.py | CheckMKHostService.delete_host | checkmk.devices:delete | CheckMKOperationResponse | hosts.delete_host | CHK-011 |
| hosts | POST | /api/checkmk/hosts/{hostname}/move | move_host | hosts.py | CheckMKHostService.move_host | checkmk.devices:write | CheckMKOperationResponse | hosts.move_host | CHK-012 |
| hosts | POST | /api/checkmk/hosts/{hostname}/rename | rename_host | hosts.py | CheckMKHostService.rename_host | checkmk.devices:write | CheckMKOperationResponse | hosts.rename_host | CHK-013 |
| hosts | POST | /api/checkmk/hosts/bulk-create | bulk_create_hosts | hosts.py | CheckMKHostService.bulk_create_hosts | checkmk.devices:write | CheckMKOperationResponse | hosts.bulk_create_hosts | CHK-014 |
| hosts | POST | /api/checkmk/hosts/bulk-update | bulk_update_hosts | hosts.py | CheckMKHostService.bulk_update_hosts | checkmk.devices:write | CheckMKOperationResponse | hosts.bulk_update_hosts | CHK-015 |
| hosts | POST | /api/checkmk/hosts/bulk-delete | bulk_delete_hosts | hosts.py | CheckMKHostService.bulk_delete_hosts | checkmk.devices:write | CheckMKOperationResponse | hosts.bulk_delete_hosts | CHK-016 |
| monitoring | GET | /api/checkmk/monitoring/hosts | get_all_monitored_hosts | monitoring.py | CheckMKMonitoringService.get_all_monitored_hosts | checkmk.devices:write | CheckMKOperationResponse | monitoring.get_all_monitored_hosts | CHK-017 |
| monitoring | GET | /api/checkmk/monitoring/hosts/{hostname} | get_monitored_host | monitoring.py | CheckMKMonitoringService.get_monitored_host | checkmk.devices:write | CheckMKOperationResponse | monitoring.get_monitored_host | CHK-018 |
| monitoring | GET | /api/checkmk/hosts/{hostname}/services | get_host_services | monitoring.py | CheckMKMonitoringService.get_host_services | checkmk.devices:write | CheckMKOperationResponse | monitoring.get_host_services | CHK-019 |
| monitoring | POST | /api/checkmk/hosts/{hostname}/services/{service}/show | show_service | monitoring.py | CheckMKMonitoringService.show_service | checkmk.devices:write | CheckMKOperationResponse | monitoring.show_service | CHK-020 |
| discovery | GET | /api/checkmk/service-discovery/host/{hostname} | get_service_discovery | discovery.py | CheckMKDiscoveryService.get_service_discovery | checkmk.devices:write | CheckMKOperationResponse | discovery.get_service_discovery | CHK-021 |
| discovery | POST | /api/checkmk/service-discovery/host/{hostname}/start | start_service_discovery | discovery.py | CheckMKDiscoveryService.start_service_discovery | checkmk.devices:write | CheckMKOperationResponse | discovery.start_service_discovery | CHK-022 |
| discovery | POST | /api/checkmk/service-discovery/host/{hostname}/wait | wait_for_service_discovery | discovery.py | CheckMKDiscoveryService.wait_for_service_discovery | checkmk.devices:write | CheckMKOperationResponse | discovery.wait_for_service_discovery | CHK-023 |
| discovery | POST | /api/checkmk/service-discovery/host/{hostname}/update-phase | update_discovery_phase | discovery.py | CheckMKDiscoveryService.update_discovery_phase | checkmk.devices:write | CheckMKOperationResponse | discovery.update_discovery_phase | CHK-024 |
| discovery | POST | /api/checkmk/service-discovery/bulk | start_bulk_discovery | discovery.py | CheckMKDiscoveryService.start_bulk_discovery | checkmk.devices:write | CheckMKOperationResponse | discovery.start_bulk_discovery | CHK-025 |
| problems | POST | /api/checkmk/acknowledge/host | acknowledge_host_problem | problems.py | CheckMKProblemsService.acknowledge_host_problem | checkmk.devices:write | CheckMKOperationResponse | problems.acknowledge_host_problem | CHK-026 |
| problems | POST | /api/checkmk/acknowledge/service | acknowledge_service_problem | problems.py | CheckMKProblemsService.acknowledge_service_problem | checkmk.devices:write | CheckMKOperationResponse | problems.acknowledge_service_problem | CHK-027 |
| problems | DELETE | /api/checkmk/acknowledge/{ack_id} | delete_acknowledgment | problems.py | CheckMKProblemsService.delete_acknowledgment | checkmk.devices:delete | CheckMKOperationResponse | problems.delete_acknowledgment | CHK-028 |
| problems | POST | /api/checkmk/downtime/host | create_host_downtime | problems.py | CheckMKProblemsService.create_host_downtime | checkmk.devices:write | CheckMKOperationResponse | problems.create_host_downtime | CHK-029 |
| problems | POST | /api/checkmk/comments/host | add_host_comment | problems.py | CheckMKProblemsService.add_host_comment | checkmk.devices:write | CheckMKOperationResponse | problems.add_host_comment | CHK-030 |
| problems | POST | /api/checkmk/comments/service | add_service_comment | problems.py | CheckMKProblemsService.add_service_comment | checkmk.devices:write | CheckMKOperationResponse | problems.add_service_comment | CHK-031 |
| activation | GET | /api/checkmk/changes/pending | get_pending_changes | activation.py | CheckMKActivationService.get_pending_changes | checkmk.devices:write | CheckMKOperationResponse | activation.get_pending_changes | CHK-032 |
| activation | POST | /api/checkmk/changes/activate | activate_changes | activation.py | CheckMKActivationService.activate_changes | checkmk.devices:write | CheckMKOperationResponse | activation.activate_changes | CHK-033 |
| activation | POST | /api/checkmk/changes/activate/{etag} | activate_changes_with_etag | activation.py | CheckMKActivationService.activate_changes_with_etag | checkmk.devices:write | CheckMKOperationResponse | activation.activate_changes_with_etag | CHK-034 |
| activation | GET | /api/checkmk/activation/{activation_id} | get_activation_status | activation.py | CheckMKActivationService.get_activation_status | checkmk.devices:write | CheckMKOperationResponse | activation.get_activation_status | CHK-035 |
| activation | POST | /api/checkmk/activation/{activation_id}/wait | wait_for_activation_completion | activation.py | CheckMKActivationService.wait_for_activation_completion | checkmk.devices:write | CheckMKOperationResponse | activation.wait_for_activation_completion | CHK-036 |
| activation | GET | /api/checkmk/activation/running | get_running_activations | activation.py | CheckMKActivationService.get_running_activations | checkmk.devices:write | CheckMKOperationResponse | activation.get_running_activations | CHK-037 |
| host-groups | GET | /api/checkmk/host-groups | get_host_groups | host_groups.py | CheckMKHostGroupService.get_host_groups | checkmk.devices:write | CheckMKOperationResponse | host-groups.get_host_groups | CHK-038 |
| host-groups | GET | /api/checkmk/host-groups/{group_name} | get_host_group | host_groups.py | CheckMKHostGroupService.get_host_group | checkmk.devices:write | CheckMKOperationResponse | host-groups.get_host_group | CHK-039 |
| host-groups | POST | /api/checkmk/host-groups | create_host_group | host_groups.py | CheckMKHostGroupService.create_host_group | checkmk.devices:write | CheckMKOperationResponse | host-groups.create_host_group | CHK-040 |
| host-groups | PUT | /api/checkmk/host-groups/{name} | update_host_group | host_groups.py | CheckMKHostGroupService.update_host_group | checkmk.devices:write | CheckMKOperationResponse | host-groups.update_host_group | CHK-041 |
| host-groups | DELETE | /api/checkmk/host-groups/{name} | delete_host_group | host_groups.py | CheckMKHostGroupService.delete_host_group | checkmk.devices:delete | CheckMKOperationResponse | host-groups.delete_host_group | CHK-042 |
| host-groups | PUT | /api/checkmk/host-groups/bulk-update | bulk_update_host_groups | host_groups.py | CheckMKHostGroupService.bulk_update_host_groups | checkmk.devices:write | CheckMKOperationResponse | host-groups.bulk_update_host_groups | CHK-043 |
| host-groups | DELETE | /api/checkmk/host-groups/bulk-delete | bulk_delete_host_groups | host_groups.py | CheckMKHostGroupService.bulk_delete_host_groups | checkmk.devices:delete | CheckMKOperationResponse | host-groups.bulk_delete_host_groups | CHK-044 |
| folders | GET | /api/checkmk/folders | get_all_folders | folders.py | CheckMKFolderService.get_all_folders | checkmk.devices:write | CheckMKFolderListResponse | folders.get_all_folders | CHK-045 |
| folders | GET | /api/checkmk/folders/{folder_path} | get_folder | folders.py | CheckMKFolderService.get_folder | checkmk.devices:write | CheckMKOperationResponse | folders.get_folder | CHK-046 |
| folders | POST | /api/checkmk/folders | create_folder | folders.py | CheckMKFolderService.create_folder | checkmk.devices:write | CheckMKOperationResponse | folders.create_folder | CHK-047 |
| folders | PUT | /api/checkmk/folders/{folder_path} | update_folder | folders.py | CheckMKFolderService.update_folder | checkmk.devices:write | CheckMKOperationResponse | folders.update_folder | CHK-048 |
| folders | DELETE | /api/checkmk/folders/{folder_path} | delete_folder | folders.py | CheckMKFolderService.delete_folder | checkmk.devices:delete | CheckMKOperationResponse | folders.delete_folder | CHK-049 |
| folders | POST | /api/checkmk/folders/{folder_path}/move | move_folder | folders.py | CheckMKFolderService.move_folder | checkmk.devices:write | CheckMKOperationResponse | folders.move_folder | CHK-050 |
| folders | PUT | /api/checkmk/folders/bulk-update | bulk_update_folders | folders.py | CheckMKFolderService.bulk_update_folders | checkmk.devices:write | CheckMKOperationResponse | folders.bulk_update_folders | CHK-051 |
| folders | GET | /api/checkmk/folders/{folder_path}/hosts | get_hosts_in_folder | folders.py | CheckMKFolderService.get_hosts_in_folder | checkmk.devices:write | CheckMKOperationResponse | folders.get_hosts_in_folder | CHK-052 |
| tag-groups | GET | /api/checkmk/host-tag-groups | get_all_host_tag_groups | tag_groups.py | CheckMKTagGroupService.get_all_host_tag_groups | checkmk.devices:write | CheckMKHostTagGroupListResponse | tag-groups.get_all_host_tag_groups | CHK-053 |
| tag-groups | GET | /api/checkmk/host-tag-groups/{name} | get_host_tag_group | tag_groups.py | CheckMKTagGroupService.get_host_tag_group | checkmk.devices:write | CheckMKOperationResponse | tag-groups.get_host_tag_group | CHK-054 |
| tag-groups | POST | /api/checkmk/host-tag-groups | create_host_tag_group | tag_groups.py | CheckMKTagGroupService.create_host_tag_group | checkmk.devices:write | CheckMKOperationResponse | tag-groups.create_host_tag_group | CHK-055 |
| tag-groups | PUT | /api/checkmk/host-tag-groups/{name} | update_host_tag_group | tag_groups.py | CheckMKTagGroupService.update_host_tag_group | checkmk.devices:write | CheckMKOperationResponse | tag-groups.update_host_tag_group | CHK-056 |
| tag-groups | DELETE | /api/checkmk/host-tag-groups/{name} | delete_host_tag_group | tag_groups.py | CheckMKTagGroupService.delete_host_tag_group | checkmk.devices:delete | CheckMKOperationResponse | tag-groups.delete_host_tag_group | CHK-057 |

## Notes

- Rows are auto-populated from main.py decorators and function signatures.
- The New service method column is a migration target suggestion and may be renamed during implementation.
- If method names are renamed in services, keep old handler names in this table for traceability.
