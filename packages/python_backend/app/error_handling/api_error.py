from typing import Any

class ApiError(Exception):
    def __init__(self, status_code: int, message: str, code: str, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code
        self.details = details

    def to_dict(self) -> dict[str, Any]:
        return {
            "message": self.message,
            "code": self.code,
            "details": self.details
        }
