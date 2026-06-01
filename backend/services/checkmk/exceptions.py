"""
CheckMK domain exceptions.
"""


class CheckMKClientError(Exception):
    """Exception raised when CheckMK client cannot be created or used."""

    pass


class HostNotFoundError(Exception):
    """Exception raised when a host is not found in CheckMK."""

    pass


class CheckMKAPIError(Exception):
    """Exception raised for CheckMK REST API errors."""

    def __init__(
        self, message: str, status_code: int = None, response_data: dict = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data
