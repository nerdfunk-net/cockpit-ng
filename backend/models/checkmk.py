"""
CheckMK models for API requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class CheckMKSettings(BaseModel):
    """CheckMK connection settings"""

    url: str = Field(..., description="CheckMK server URL")
    site: str = Field(..., description="CheckMK site name")
    username: str = Field(..., description="CheckMK username")
    password: str = Field(..., description="CheckMK password")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates")


class CheckMKTestConnectionRequest(BaseModel):
    """Request model for testing CheckMK connection"""

    url: str = Field(..., description="CheckMK server URL")
    site: str = Field(..., description="CheckMK site name")
    username: str = Field(..., description="CheckMK username")
    password: str = Field(..., description="CheckMK password")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates")


class CheckMKTestConnectionResponse(BaseModel):
    """Response model for CheckMK connection test"""

    success: bool = Field(..., description="Whether the connection was successful")
    message: str = Field(..., description="Connection result message")
    checkmk_url: Optional[str] = Field(None, description="CheckMK server URL")
    connection_source: Optional[str] = Field(
        None, description="Source of connection settings"
    )


# Host Management Models


class CheckMKHost(BaseModel):
    """CheckMK host representation"""

    host_name: str = Field(..., description="Host name")
    folder: str = Field(default="/", description="Folder path")
    attributes: Dict[str, Any] = Field(
        default_factory=dict, description="Host attributes"
    )
    effective_attributes: Optional[Dict[str, Any]] = Field(
        None, description="Effective attributes"
    )


class CheckMKHostCreateRequest(BaseModel):
    """Request model for creating a host"""

    host_name: str = Field(..., description="Host name")
    folder: str = Field(default="/", description="Folder path")
    attributes: Dict[str, Any] = Field(
        default_factory=dict, description="Host attributes"
    )
    bake_agent: bool = Field(default=False, description="Bake agent after creation")
    start_discovery: bool = Field(
        default=True,
        description="Start service discovery after host creation (tabula_rasa mode)",
    )
    discovery_mode: str = Field(
        default="tabula_rasa",
        description="Discovery mode to use (tabula_rasa, fix_all, new, etc.)",
    )


class CheckMKHostUpdateRequest(BaseModel):
    """Request model for updating a host"""

    attributes: Dict[str, Any] = Field(..., description="Host attributes to update")


class CheckMKHostMoveRequest(BaseModel):
    """Request model for moving a host"""

    target_folder: str = Field(..., description="Target folder path")


class CheckMKHostRenameRequest(BaseModel):
    """Request model for renaming a host"""

    new_name: str = Field(..., description="New host name")


class CheckMKBulkHostCreateRequest(BaseModel):
    """Request model for bulk host creation"""

    entries: List[CheckMKHostCreateRequest] = Field(
        ..., description="List of hosts to create"
    )


class CheckMKBulkHostUpdateRequest(BaseModel):
    """Request model for bulk host updates"""

    entries: Dict[str, CheckMKHostUpdateRequest] = Field(
        ..., description="Hosts to update (hostname -> update data)"
    )


class CheckMKBulkHostDeleteRequest(BaseModel):
    """Request model for bulk host deletion"""

    entries: List[str] = Field(..., description="List of hostnames to delete")


# Monitoring Models


class CheckMKHostStatus(BaseModel):
    """CheckMK host status"""

    host_name: str = Field(..., description="Host name")
    state: int = Field(..., description="Host state (0=UP, 1=DOWN, 2=UNREACHABLE)")
    state_type: int = Field(..., description="State type (0=SOFT, 1=HARD)")
    plugin_output: str = Field(..., description="Plugin output")
    perf_data: Optional[str] = Field(None, description="Performance data")
    last_check: Optional[datetime] = Field(None, description="Last check time")


class CheckMKService(BaseModel):
    """CheckMK service representation"""

    host_name: str = Field(..., description="Host name")
    service_description: str = Field(..., description="Service description")
    state: int = Field(..., description="Service state")
    plugin_output: str = Field(..., description="Plugin output")
    perf_data: Optional[str] = Field(None, description="Performance data")


class CheckMKServiceQueryRequest(BaseModel):
    """Request model for service queries"""

    columns: Optional[List[str]] = Field(None, description="Columns to return")
    query: Optional[str] = Field(None, description="Query filter")


# Service Discovery Models

from enum import Enum


class ServiceDiscoveryMode(str, Enum):
    """Service discovery mode enum"""

    NEW = "new"  # Monitor undecided services
    REMOVE = "remove"  # Remove vanished services
    FIX_ALL = "fix_all"  # Accept all
    REFRESH = "refresh"  # Rescan (background job)
    ONLY_HOST_LABELS = "only_host_labels"  # Update host labels
    ONLY_SERVICE_LABELS = "only_service_labels"  # Update service labels
    TABULA_RASA = "tabula_rasa"  # Remove all and find new (background job)


class CheckMKServiceDiscoveryRequest(BaseModel):
    """Request model for service discovery"""

    mode: ServiceDiscoveryMode = Field(
        default=ServiceDiscoveryMode.FIX_ALL,
        description=(
            "Discovery mode:\n"
            "- new: Monitor undecided services\n"
            "- remove: Remove vanished services\n"
            "- fix_all: Accept all (default)\n"
            "- refresh: Rescan (starts background job)\n"
            "- only_host_labels: Update host labels\n"
            "- only_service_labels: Update service labels\n"
            "- tabula_rasa: Remove all and find new (starts background job)"
        ),
    )


class CheckMKDiscoveryPhaseUpdateRequest(BaseModel):
    """Request model for discovery phase updates"""

    phase: str = Field(..., description="Discovery phase")
    services: Optional[List[str]] = Field(None, description="Services to update")


class CheckMKBulkDiscoveryOptions(BaseModel):
    """Options for bulk discovery"""

    monitor_undecided_services: bool = Field(
        default=True, description="Monitor undecided services"
    )
    remove_vanished_services: bool = Field(
        default=True, description="Remove vanished services"
    )
    update_service_labels: bool = Field(
        default=True, description="Update service labels"
    )
    update_service_parameters: bool = Field(
        default=True, description="Update service parameters"
    )
    update_host_labels: bool = Field(default=True, description="Update host labels")


class CheckMKBulkDiscoveryRequest(BaseModel):
    """Request model for bulk service discovery"""

    hostnames: List[str] = Field(..., description="List of host names to discover")
    options: CheckMKBulkDiscoveryOptions = Field(
        default_factory=CheckMKBulkDiscoveryOptions,
        description="Discovery options for the bulk discovery",
    )
    do_full_scan: bool = Field(
        default=True, description="Whether to perform a full scan"
    )
    bulk_size: int = Field(
        default=10, description="Number of hosts to be handled at once"
    )
    ignore_errors: bool = Field(
        default=True, description="Whether to ignore errors in single check plug-ins"
    )


# Problem Management Models


class CheckMKAcknowledgeHostRequest(BaseModel):
    """Request model for host problem acknowledgment"""

    host_name: str = Field(..., description="Host name")
    comment: str = Field(..., description="Acknowledgment comment")
    sticky: bool = Field(default=False, description="Sticky acknowledgment")
    persistent: bool = Field(default=False, description="Persistent acknowledgment")
    notify: bool = Field(default=False, description="Send notifications")


class CheckMKAcknowledgeServiceRequest(BaseModel):
    """Request model for service problem acknowledgment"""

    host_name: str = Field(..., description="Host name")
    service_description: str = Field(..., description="Service description")
    comment: str = Field(..., description="Acknowledgment comment")
    sticky: bool = Field(default=False, description="Sticky acknowledgment")
    persistent: bool = Field(default=False, description="Persistent acknowledgment")
    notify: bool = Field(default=False, description="Send notifications")


class CheckMKDowntimeRequest(BaseModel):
    """Request model for downtime creation"""

    host_name: str = Field(..., description="Host name")
    start_time: str = Field(..., description="Start time (ISO format)")
    end_time: str = Field(..., description="End time (ISO format)")
    comment: str = Field(default="Scheduled downtime", description="Downtime comment")
    downtime_type: str = Field(default="fixed", description="Downtime type")


class CheckMKCommentRequest(BaseModel):
    """Request model for adding comments"""

    host_name: str = Field(..., description="Host name")
    service_description: Optional[str] = Field(
        None, description="Service description (for service comments)"
    )
    comment: str = Field(..., description="Comment text")
    persistent: bool = Field(default=False, description="Persistent comment")


# Configuration Management Models


class CheckMKActivateChangesRequest(BaseModel):
    """Request model for activating changes"""

    sites: Optional[List[str]] = Field(None, description="Sites to activate changes on")
    force_foreign_changes: bool = Field(
        default=True, description="Force foreign changes"
    )
    redirect: bool = Field(default=False, description="Redirect after activation")


class CheckMKPendingChange(BaseModel):
    """Pending configuration change"""

    change_id: str = Field(..., description="Change ID")
    user_id: str = Field(..., description="User who made the change")
    action_name: str = Field(..., description="Action name")
    text: str = Field(..., description="Change description")
    time: datetime = Field(..., description="Change timestamp")


class CheckMKActivationRun(BaseModel):
    """Activation run status"""

    activation_id: str = Field(..., description="Activation ID")
    state: str = Field(..., description="Activation state")
    time_started: datetime = Field(..., description="Start time")
    time_finished: Optional[datetime] = Field(None, description="Finish time")


# Host Groups Models


class CheckMKHostGroup(BaseModel):
    """CheckMK host group"""

    name: str = Field(..., description="Group name")
    alias: Optional[str] = Field(None, description="Group alias")


class CheckMKHostGroupCreateRequest(BaseModel):
    """Request model for creating host groups"""

    name: str = Field(..., description="Group name")
    alias: Optional[str] = Field(None, description="Group alias")


# Response Models


class CheckMKHostListResponse(BaseModel):
    """Response model for host list"""

    hosts: List[CheckMKHost] = Field(..., description="List of hosts")
    total: int = Field(..., description="Total number of hosts")


class CheckMKHostStatusListResponse(BaseModel):
    """Response model for host status list"""

    hosts: List[CheckMKHostStatus] = Field(..., description="List of host statuses")
    total: int = Field(..., description="Total number of hosts")


class CheckMKServiceListResponse(BaseModel):
    """Response model for service list"""

    services: List[CheckMKService] = Field(..., description="List of services")
    total: int = Field(..., description="Total number of services")


class CheckMKPendingChangesResponse(BaseModel):
    """Response model for pending changes"""

    changes: List[CheckMKPendingChange] = Field(..., description="Pending changes")
    total: int = Field(..., description="Total number of changes")


class CheckMKHostGroupListResponse(BaseModel):
    """Response model for host group list"""

    groups: List[CheckMKHostGroup] = Field(..., description="List of host groups")
    total: int = Field(..., description="Total number of groups")


class CheckMKVersionResponse(BaseModel):
    """Response model for CheckMK version"""

    version: str = Field(..., description="CheckMK version")
    edition: Optional[str] = Field(None, description="CheckMK edition")
    demo: Optional[bool] = Field(None, description="Demo version flag")


class CheckMKOperationResponse(BaseModel):
    """Generic response model for CheckMK operations"""

    success: bool = Field(..., description="Operation success status")
    message: Optional[str] = Field(None, description="Operation message")
    data: Optional[Dict[str, Any]] = Field(None, description="Operation result data")


# Folder Management Models


class CheckMKFolder(BaseModel):
    """CheckMK folder representation"""

    name: str = Field(..., description="Folder name")
    title: str = Field(..., description="Folder title")
    parent: str = Field(..., description="Parent folder path")
    path: str = Field(..., description="Full folder path")
    attributes: Dict[str, Any] = Field(
        default_factory=dict, description="Folder attributes"
    )
    hosts: Optional[List[str]] = Field(None, description="List of host names in folder")


class CheckMKFolderCreateRequest(BaseModel):
    """Request model for creating a folder"""

    name: str = Field(..., description="Folder name")
    title: str = Field(..., description="Folder title")
    parent: str = Field(default="/", description="Parent folder path")
    attributes: Dict[str, Any] = Field(
        default_factory=dict, description="Folder attributes"
    )


class CheckMKFolderUpdateRequest(BaseModel):
    """Request model for updating a folder"""

    title: Optional[str] = Field(None, description="Folder title")
    attributes: Optional[Dict[str, Any]] = Field(
        None, description="Folder attributes to update"
    )
    remove_attributes: Optional[List[str]] = Field(
        None, description="Attributes to remove"
    )


class CheckMKFolderMoveRequest(BaseModel):
    """Request model for moving a folder"""

    destination: str = Field(..., description="Destination folder path")


class CheckMKFolderBulkUpdateRequest(BaseModel):
    """Request model for bulk folder updates"""

    entries: List[Dict[str, Any]] = Field(..., description="Folder updates")


class CheckMKFolderListResponse(BaseModel):
    """Response model for folder list"""

    folders: List[CheckMKFolder] = Field(..., description="List of folders")
    total: int = Field(..., description="Total number of folders")


# Host Tag Groups Models


class CheckMKHostTag(BaseModel):
    """CheckMK host tag representation"""

    id: str = Field(..., description="Tag ID")
    title: str = Field(..., description="Tag title")
    aux_tags: Optional[List[str]] = Field(None, description="Auxiliary tags")


class CheckMKHostTagGroup(BaseModel):
    """CheckMK host tag group representation"""

    id: str = Field(..., description="Tag group ID")
    title: str = Field(..., description="Tag group title")
    topic: Optional[str] = Field(None, description="Tag group topic")
    help: Optional[str] = Field(None, description="Tag group help text")
    tags: List[CheckMKHostTag] = Field(..., description="List of tags in the group")


class CheckMKHostTagGroupCreateRequest(BaseModel):
    """Request model for creating a host tag group"""

    id: str = Field(..., description="Tag group ID")
    title: str = Field(..., description="Tag group title")
    topic: Optional[str] = Field(None, description="Tag group topic")
    help: Optional[str] = Field(None, description="Tag group help text")
    tags: List[CheckMKHostTag] = Field(..., description="List of tags in the group")


class CheckMKHostTagGroupUpdateRequest(BaseModel):
    """Request model for updating a host tag group"""

    title: Optional[str] = Field(None, description="Tag group title")
    topic: Optional[str] = Field(None, description="Tag group topic")
    help: Optional[str] = Field(None, description="Tag group help text")
    tags: Optional[List[CheckMKHostTag]] = Field(
        None, description="List of tags in the group"
    )
    repair: Optional[bool] = Field(False, description="Repair affected hosts")


class CheckMKHostTagGroupListResponse(BaseModel):
    """Response model for host tag group list"""

    tag_groups: List[CheckMKHostTagGroup] = Field(
        ..., description="List of host tag groups"
    )
    total: int = Field(..., description="Total number of host tag groups")


# Additional Host Group Models (for completion)


class CheckMKHostGroupUpdateRequest(BaseModel):
    """Request model for updating a host group"""

    alias: Optional[str] = Field(None, description="Host group alias/description")


class CheckMKHostGroupBulkUpdateRequest(BaseModel):
    """Request model for bulk host group updates"""

    entries: List[Dict[str, Any]] = Field(
        ..., description="Host group updates with name and attributes"
    )


class CheckMKHostGroupBulkDeleteRequest(BaseModel):
    """Request model for bulk host group deletions"""

    entries: List[str] = Field(..., description="List of host group names to delete")
