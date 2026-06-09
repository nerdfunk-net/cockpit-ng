"""Pure normalization helpers for baseline import.

Stateless functions and shared constants used by
:class:`services.network.tools.baseline.BaselineImportService`.
"""

from typing import Any, Dict, List

DEFAULT_CLUSTER_TYPE_NAME = "cluster-type"
DEFAULT_TAG_CONTENT_TYPES = [
    "dcim.device",
    "virtualization.virtualmachine",
    "virtualization.cluster",
]
STATUS_CONTENT_TYPE_LOCATION = "dcim.location"
STATUS_CONTENT_TYPE_VM = "virtualization.virtualmachine"
STATUS_CONTENT_TYPE_VM_INTERFACE = "virtualization.vminterface"
STATUS_CONTENT_TYPE_IP_ADDRESS = "ipam.ipaddress"


def normalize_content_types(content_types: Any) -> List[str]:
    """Normalize YAML/API content_types to a sorted list of 'app_label.model' strings."""
    if content_types is None:
        return []
    if isinstance(content_types, str):
        return [content_types]
    if not isinstance(content_types, list):
        return []

    normalized: List[str] = []
    for item in content_types:
        if isinstance(item, str):
            normalized.append(item)
        elif isinstance(item, dict):
            app_label = item.get("app_label")
            model = item.get("model")
            if app_label and model:
                normalized.append(f"{app_label}.{model}")
            elif isinstance(item.get("display"), str) and "." in item["display"]:
                normalized.append(item["display"])
    return sorted(set(normalized))


def normalize_location_type_content_types(content_types: Any) -> List[str]:
    """
    Normalize content_types for LocationType create/update.

    Virtual machines are not associated to locations directly in Nautobot; clusters
    are. Map legacy ``virtualization.virtualmachine`` to ``virtualization.cluster``.
    """
    normalized: List[str] = []
    for ct in normalize_content_types(content_types):
        if ct == "virtualization.virtualmachine":
            normalized.append("virtualization.cluster")
        else:
            normalized.append(ct)
    return sorted(set(normalized))


def content_types_from_api_record(record: Dict[str, Any]) -> List[str]:
    """Extract content type strings from a Nautobot location-type API record."""
    return normalize_location_type_content_types(record.get("content_types"))


def tag_content_types_from_api_record(record: Dict[str, Any]) -> List[str]:
    """Extract content type strings from a Nautobot tag API record."""
    return normalize_content_types(record.get("content_types"))


def desired_tag_content_types(tag: Dict[str, Any]) -> List[str]:
    """Merge YAML tag content_types with defaults required for baseline import."""
    from_yaml = normalize_content_types(tag.get("content_types"))
    if not from_yaml:
        from_yaml = list(DEFAULT_TAG_CONTENT_TYPES)
    return sorted(set(from_yaml) | set(DEFAULT_TAG_CONTENT_TYPES))


def sort_location_types_by_parent(
    location_types: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Return location types ordered so parents are created before children."""
    by_name = {lt["name"]: lt for lt in location_types}
    sorted_list: List[Dict[str, Any]] = []
    resolved: set[str] = set()

    def visit(name: str) -> None:
        if name in resolved or name not in by_name:
            return
        lt = by_name[name]
        parent = lt.get("parent")
        if parent and parent in by_name:
            visit(parent)
        sorted_list.append(lt)
        resolved.add(name)

    for lt in location_types:
        visit(lt["name"])
    return sorted_list
