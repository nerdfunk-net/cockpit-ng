from ._activation import _ActivationMixin
from ._base import _CheckMKBase
from ._discovery import _DiscoveryMixin
from ._folders import _FoldersMixin
from ._host_groups import _HostGroupsMixin
from ._hosts import _HostsMixin
from ._monitoring import _MonitoringMixin
from ._problems import _ProblemsMixin
from ._tag_groups import _TagGroupsMixin

__all__ = ["CheckMKClient"]


class CheckMKClient(
    _HostsMixin,
    _FoldersMixin,
    _HostGroupsMixin,
    _TagGroupsMixin,
    _MonitoringMixin,
    _DiscoveryMixin,
    _ActivationMixin,
    _ProblemsMixin,
    _CheckMKBase,
):
    """CheckMK REST API Client — composed from per-resource mixins."""
