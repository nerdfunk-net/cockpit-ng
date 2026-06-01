from typing import Any, Dict, List

import yaml


def export_to_yaml(devices: List[Dict[str, Any]]) -> str:
    """Export devices to YAML format."""
    return yaml.dump(
        devices, default_flow_style=False, allow_unicode=True, sort_keys=False
    )
