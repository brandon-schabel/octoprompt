import math
from datetime import datetime, timezone
from typing import Optional, Union

def convert_timestamp_to_ms_int(value: Union[None, str, int, float, datetime]) -> Optional[int]:
    """
    Convert various timestamp formats to integer Unix milliseconds.
    
    Args:
        value: Can be None, ISO string, Unix ms (int/float), or datetime object
        
    Returns:
        Integer Unix milliseconds or None if input is None
        
    Raises:
        ValueError: For invalid timestamp formats or NaN values
        TypeError: For unsupported types (including booleans)
    """
    if value is None:
        return None
    
    # Check for boolean BEFORE checking for int (since bool is subclass of int in Python)
    if isinstance(value, bool):
        raise TypeError("Timestamp for conversion to ms int must be None, string, int, float, or datetime, not bool")
    
    if isinstance(value, str):
        try:
            # Parse ISO format string to datetime
            # Handle various ISO formats including with/without milliseconds
            if value.endswith('Z'):
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
            else:
                dt = datetime.fromisoformat(value)
            
            # Convert to Unix milliseconds
            return int(dt.timestamp() * 1000)
        except ValueError:
            raise ValueError(f"Invalid timestamp string format: {value}")
    
    elif isinstance(value, (int, float)):
        # Check for NaN
        if math.isnan(value):
            raise ValueError("NaN is not a valid timestamp value")
        # Already in milliseconds, just ensure it's an int
        return int(value)
    
    elif isinstance(value, datetime):
        # Convert datetime to Unix milliseconds
        # If naive datetime (no timezone), assume UTC
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return int(value.timestamp() * 1000)
    
    else:
        raise TypeError(f"Timestamp for conversion to ms int must be None, string, int, float, or datetime, not {type(value).__name__}")

def convert_id_to_int(value: Union[int, float, str]) -> int:
    """
    Convert ID values to integer.
    
    Args:
        value: Can be int, float, or string representation of a number
        
    Returns:
        Integer ID
        
    Raises:
        ValueError: For invalid string formats
        TypeError: For unsupported types or NaN values
    """
    if isinstance(value, bool):
        raise TypeError("ID must be an integer, float, or a string representation of a number, not bool")
        
    if isinstance(value, int):
        return value
    
    elif isinstance(value, float):
        if math.isnan(value):
            raise TypeError("ID must be a valid number, not NaN")
        return int(value)
    
    elif isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            raise ValueError(f"ID string '{value}' is not a valid integer")
    
    else:
        raise TypeError(f"ID must be an integer, float, or a string representation of a number, not {type(value).__name__}")

def convert_optional_id_to_int(value: Optional[Union[int, float, str]]) -> Optional[int]:
    """
    Convert optional ID values to integer.
    
    Args:
        value: Can be None, int, float, or string representation of a number
        
    Returns:
        Integer ID or None
        
    Raises:
        ValueError: For invalid string formats
        TypeError: For unsupported types or NaN values
    """
    if value is None:
        return None
    return convert_id_to_int(value)