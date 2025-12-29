"""
Settings Repository - handles database operations for application settings.
"""

from typing import Optional
from core.models import (
    NautobotSetting,
    GitSetting,
    CheckMKSetting,
    GrafanaSetting,
    CacheSetting,
    CelerySetting,
    NautobotDefault,
    DeviceOffboardingSetting,
    SettingsMetadata,
)
from core.database import get_db_session
from repositories.base import BaseRepository
import logging

logger = logging.getLogger(__name__)


class NautobotSettingRepository(BaseRepository[NautobotSetting]):
    """Repository for Nautobot settings."""

    def __init__(self):
        super().__init__(NautobotSetting)

    def get_settings(self) -> Optional[NautobotSetting]:
        """Get the first (and should be only) Nautobot settings record."""
        session = get_db_session()
        try:
            return session.query(NautobotSetting).first()
        finally:
            session.close()


class GitSettingRepository(BaseRepository[GitSetting]):
    """Repository for Git settings."""

    def __init__(self):
        super().__init__(GitSetting)

    def get_settings(self) -> Optional[GitSetting]:
        """Get the first (and should be only) Git settings record."""
        session = get_db_session()
        try:
            return session.query(GitSetting).first()
        finally:
            session.close()


class CheckMKSettingRepository(BaseRepository[CheckMKSetting]):
    """Repository for CheckMK settings."""

    def __init__(self):
        super().__init__(CheckMKSetting)

    def get_settings(self) -> Optional[CheckMKSetting]:
        """Get the first (and should be only) CheckMK settings record."""
        session = get_db_session()
        try:
            return session.query(CheckMKSetting).first()
        finally:
            session.close()


class GrafanaSettingRepository(BaseRepository[GrafanaSetting]):
    """Repository for Grafana settings."""

    def __init__(self):
        super().__init__(GrafanaSetting)

    def get_settings(self) -> Optional[GrafanaSetting]:
        """Get the first (and should be only) Grafana settings record."""
        session = get_db_session()
        try:
            return session.query(GrafanaSetting).first()
        finally:
            session.close()


class CacheSettingRepository(BaseRepository[CacheSetting]):
    """Repository for Cache settings."""

    def __init__(self):
        super().__init__(CacheSetting)

    def get_settings(self) -> Optional[CacheSetting]:
        """Get the first (and should be only) Cache settings record."""
        session = get_db_session()
        try:
            return session.query(CacheSetting).first()
        finally:
            session.close()


class CelerySettingRepository(BaseRepository[CelerySetting]):
    """Repository for Celery settings."""

    def __init__(self):
        super().__init__(CelerySetting)

    def get_settings(self) -> Optional[CelerySetting]:
        """Get the first (and should be only) Celery settings record."""
        session = get_db_session()
        try:
            return session.query(CelerySetting).first()
        finally:
            session.close()


class NautobotDefaultRepository(BaseRepository[NautobotDefault]):
    """Repository for Nautobot defaults."""

    def __init__(self):
        super().__init__(NautobotDefault)

    def get_defaults(self) -> Optional[NautobotDefault]:
        """Get the first (and should be only) Nautobot defaults record."""
        session = get_db_session()
        try:
            return session.query(NautobotDefault).first()
        finally:
            session.close()


class DeviceOffboardingSettingRepository(BaseRepository[DeviceOffboardingSetting]):
    """Repository for Device Offboarding settings."""

    def __init__(self):
        super().__init__(DeviceOffboardingSetting)

    def get_settings(self) -> Optional[DeviceOffboardingSetting]:
        """Get the first (and should be only) Offboarding settings record."""
        session = get_db_session()
        try:
            return session.query(DeviceOffboardingSetting).first()
        finally:
            session.close()


class SettingsMetadataRepository(BaseRepository[SettingsMetadata]):
    """Repository for Settings metadata."""

    def __init__(self):
        super().__init__(SettingsMetadata)

    def get_by_key(self, key: str) -> Optional[SettingsMetadata]:
        """Get metadata by key."""
        session = get_db_session()
        try:
            return (
                session.query(SettingsMetadata)
                .filter(SettingsMetadata.key == key)
                .first()
            )
        finally:
            session.close()

    def set_metadata(self, key: str, value: str) -> None:
        """Set or update metadata value."""
        session = get_db_session()
        try:
            metadata = (
                session.query(SettingsMetadata)
                .filter(SettingsMetadata.key == key)
                .first()
            )
            if metadata:
                metadata.value = value
                session.commit()
            else:
                new_metadata = SettingsMetadata(key=key, value=value)
                session.add(new_metadata)
                session.commit()
        finally:
            session.close()
