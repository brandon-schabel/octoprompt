import math
from datetime import datetime, timezone
from typing import Optional, Union

def convert_timestamp_to_ms_int(value: Union[None, str, int, float, datetime]) -> Optional[int]:
    if value is None:
        return None
    
    if isinstance(value, bool):
        raise TypeError("Timestamp for conversion to ms int must be None, string, int, float, or datetime, not bool")
    
    if isinstance(value, str):
        try:
            if value.endswith('Z'):
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
            else:
                dt = datetime.fromisoformat(value)
            return int(dt.timestamp() * 1000)
        except ValueError:
            raise ValueError(f"Invalid timestamp string format: {value}")
    
    elif isinstance(value, (int, float)):
        if math.isnan(value):
            raise ValueError("NaN is not a valid timestamp value")
        return int(value)
    
    elif isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return int(value.timestamp() * 1000)
    
    else:
        raise TypeError(f"Timestamp for conversion to ms int must be None, string, int, float, or datetime, not {type(value).__name__}")