from typing import Any, Optional

class ApiError(Exception):
    def __init__(self, status: int = 500, message: str = "Internal Server Error", code: str = "INTERNAL_ERROR", details: Optional[Any] = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.details = details
        self.name = "ApiError"

# Example usage:
# if __name__ == "__main__":
#     try:
#         raise ApiError(404, "Resource not found", "NOT_FOUND", {"id": 123})
#     except ApiError as e:
#         print(f"Caught ApiError: Status={e.status}, Message='{e.args[0]}', Code='{e.code}', Details={e.details}")
#     except Exception as e:
#         print(f"Caught other exception: {e}")
