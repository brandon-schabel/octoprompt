from datetime import datetime
from typing import Any

# Validator for timestamps (int Unix ms)
def convert_timestamp_to_ms_int(value: Any) -> int:
    if isinstance(value, str):
        try:
            # Handle ISO format strings, including those with 'Z'
            dt_obj = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return int(dt_obj.timestamp() * 1000)
        except ValueError:
            raise ValueError(f"Invalid timestamp string format: {value}")
    elif isinstance(value, (int, float)):
        return int(value) # Assume it's already in ms or can be directly converted
    elif isinstance(value, datetime):
        return int(value.timestamp() * 1000)
    raise TypeError(f"Timestamp must be an ISO string, int, float, or datetime, got {type(value)}")



# Validator for IDs (int Unix ms)
def convert_id_to_int(value: Any) -> int:
    if isinstance(value, (int, float)): return int(value)
    if isinstance(value, str): # For potential old string IDs
        try: return int(value) # Simple conversion, might need more robust if prefixes were used
        except ValueError: pass
    raise TypeError('ID must be an integer or convertible to integer')