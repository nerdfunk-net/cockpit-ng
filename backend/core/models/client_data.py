from sqlalchemy import Column, DateTime, Index, Integer, String
from sqlalchemy.sql import func

from core.database import Base


class ClientIpAddress(Base):
    """Stores ARP table entries collected from network devices.

    Joined to ClientMacAddress via mac_address + session_id.
    Joined to ClientHostname via ip_address + session_id.
    """

    __tablename__ = "client_ip_addresses"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        String(36), nullable=False
    )  # UUID of the collection run — cross-table join key
    ip_address = Column(String(45), nullable=False)  # IPv4 or IPv6
    mac_address = Column(
        String(20), nullable=True
    )  # dotted-quad format (e.g. aabb.cc00.0100), join key to ClientMacAddress
    interface = Column(String(255), nullable=True)  # ARP interface
    device_name = Column(String(255), nullable=False)  # source network device name
    device_ip = Column(String(45), nullable=True)  # primary IP of the source device
    collected_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_client_ip_session", "session_id"),
        Index("idx_client_ip_device", "device_name"),
        Index("idx_client_ip_mac", "mac_address"),
    )


class ClientMacAddress(Base):
    """Stores MAC address table entries collected from network devices.

    Joined to ClientIpAddress via mac_address + session_id.
    """

    __tablename__ = "client_mac_addresses"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), nullable=False)
    mac_address = Column(
        String(20), nullable=False
    )  # dotted-quad format — join key to ClientIpAddress
    vlan = Column(String(20), nullable=True)
    port = Column(String(255), nullable=True)  # switch port / destination port
    device_name = Column(String(255), nullable=False)  # source network device name
    device_ip = Column(String(45), nullable=True)  # primary IP of the source device
    collected_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_client_mac_session", "session_id"),
        Index("idx_client_mac_device", "device_name"),
        Index("idx_client_mac_mac", "mac_address"),
    )


class ClientHostname(Base):
    """Stores DNS-resolved hostnames for IP addresses collected from network devices.

    Joined to ClientIpAddress via ip_address + session_id.
    """

    __tablename__ = "client_hostnames"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), nullable=False)
    ip_address = Column(
        String(45), nullable=False
    )  # join key to ClientIpAddress.ip_address
    hostname = Column(String(255), nullable=False)  # DNS-resolved name
    device_name = Column(String(255), nullable=False)  # source network device name
    device_ip = Column(String(45), nullable=True)  # primary IP of the source device
    collected_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_client_hostname_session", "session_id"),
        Index("idx_client_hostname_ip", "ip_address"),
    )
