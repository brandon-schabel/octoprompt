# packages/python_backend/app/utils/storage_timestap_utils.py
import math
from datetime import datetime, timezone # Ensure timezone is imported
from typing import Any, Optional

# This function is intended to convert various inputs to an integer representing Unix milliseconds.
# It's used as a Pydantic validator in project_storage.py for fields that are stored as int(ms).
def convert_timestamp_to_ms_int(value: Any) -> Optional[int]:
    if value is None:
        return None # Pass None through for optional fields

    if isinstance(value, str):
        try:
            # Handle ISO format strings, including those with 'Z' by ensuring UTC offset
            dt_obj = datetime.fromisoformat(value.replace('Z', '+00:00'))
            # fromisoformat with an offset (like +00:00) produces an aware datetime object.
            return int(dt_obj.timestamp() * 1000)
        except ValueError:
            # Consider if we want to try parsing with parse_timestamp from the other utility for more complex strings
            # For now, strict ISO with 'Z' or offset.
            raise ValueError(f"Invalid timestamp string format for conversion to ms int: {value}")

    elif isinstance(value, (int, float)):
        if math.isnan(value): # Check for float NaN
            raise ValueError("NaN is not a valid timestamp value for conversion to ms int")
        # For int/float, assume it's already in milliseconds as per original Pydantic validator context.
        # The system writes millisecond integers, so when reading them, they should be treated as such.
        # Applying a heuristic here could corrupt small millisecond values (e.g. early epoch times)
        # or be redundant for values already correctly in milliseconds.
        return int(value)

    elif isinstance(value, datetime):
        # If datetime object is naive, assume UTC. Otherwise, respect its timezone for conversion.
        aware_dt = value
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            aware_dt = value.replace(tzinfo=timezone.utc)
        return int(aware_dt.timestamp() * 1000)

    raise TypeError(f"Timestamp for conversion to ms int must be an ISO string, int, float, datetime, or None, got {type(value)}")


# Validator for IDs (ensuring they are integers)
def convert_id_to_int(value: Any) -> int:
    if isinstance(value, (int, float)):
        if math.isnan(value): # Check for float NaN
             raise TypeError('ID must be a valid number, not NaN, when converting to int')
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            # Explicitly raise to indicate the string was not a valid integer representation
            raise ValueError(f"ID string '{value}' is not a valid integer representation")
    raise TypeError(f"ID must be an integer, float, or a string convertible to an integer, got {type(value)}")