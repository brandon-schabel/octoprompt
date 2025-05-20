# parse_timestamp.py
# 1. Initial Python conversion from TypeScript.
# 2. Used datetime and dateutil.parser (optional) for robust parsing.
# 3. Handled numeric (seconds/milliseconds) and common string timestamp formats.
# 4. Ensured all returned datetime objects are timezone-aware (UTC).
# 5. Implemented normalize_to_iso_string to output 'Z' suffixed ISO strings.

import math
from datetime import datetime, timezone
from typing import Any, Optional

# Attempt to import dateutil.parser for more robust string parsing.
# If not available, fallback to more basic parsing.
try:
    from dateutil.parser import parse as dateutil_parse
    HAS_DATEUTIL = True
except ImportError:
    HAS_DATEUTIL = False
    dateutil_parse = None # Placeholder

# Heuristic threshold from original JS: if numeric ts > 10^11, assume ms, else s.
NUMERIC_TIMESTAMP_MS_THRESHOLD = 10**11 

def parse_timestamp(ts_value: Any) -> Optional[datetime]:
    """
    Safely parses a timestamp from various formats into a timezone-aware UTC datetime object.
    Handles None, datetime instances, numbers (Unix timestamp in s or ms),
    and common date string formats. Returns None if parsing fails.
    """
    if ts_value is None: return None

    if isinstance(ts_value, datetime): # Already a datetime object
        return ts_value.astimezone(timezone.utc) if ts_value.tzinfo else ts_value.replace(tzinfo=timezone.utc)

    if isinstance(ts_value, (int, float)):
        if math.isnan(ts_value): return None
        try:
            # Determine if value is likely seconds or milliseconds based on original heuristic
            # datetime.fromtimestamp expects seconds.
            ms_equivalent = ts_value if ts_value > NUMERIC_TIMESTAMP_MS_THRESHOLD else ts_value * 1000
            return datetime.fromtimestamp(ms_equivalent / 1000.0, tz=timezone.utc)
        except (ValueError, OverflowError, OSError): return None # Invalid timestamp value

    if isinstance(ts_value, str):
        val = ts_value.strip()
        if not val: return None
        
        parsed_dt: Optional[datetime] = None
        if HAS_DATEUTIL and dateutil_parse:
            try: parsed_dt = dateutil_parse(val)
            except (ValueError, OverflowError, TypeError): pass # TypeError for unparseable formats
        
        if not parsed_dt: # Fallback if dateutil not available or failed
            try: # Attempt ISO 8601 format (YYYY-MM-DDTHH:MM:SS[.ffffff][Z or +/-HH:MM])
                 # Replace space with T for common SQL-like formats
                iso_val = val.replace(' ', 'T', 1) if 'T' not in val and ' ' in val else val
                # fromisoformat handles 'Z' by converting to UTC offset internally
                # Ensure string is compatible, remove 'Z' if fromisoformat variant doesn't like it with offset
                if iso_val.endswith('Z'): 
                    parsed_dt = datetime.fromisoformat(iso_val[:-1]).replace(tzinfo=timezone.utc)
                else:
                    parsed_dt = datetime.fromisoformat(iso_val)
            except ValueError: pass # Basic ISO parse failed

        if parsed_dt: # If any parsing succeeded
            return parsed_dt.astimezone(timezone.utc) if parsed_dt.tzinfo else parsed_dt.replace(tzinfo=timezone.utc)
            
    return None # Unparseable type or format

def normalize_to_iso_string(ts_value: Any) -> Optional[str]:
    """
    Parses a timestamp and returns it as a full ISO 8601 string (YYYY-MM-DDTHH:mm:ss.sssZ).
    Returns None if the input timestamp cannot be parsed.
    """
    date_obj = parse_timestamp(ts_value) # This returns a UTC-aware datetime
    if date_obj:
        # .isoformat() on UTC-aware datetime includes offset like +00:00.
        # We want 'Z' suffix for UTC, matching JavaScript's toISOString().
        # timespec='milliseconds' ensures three decimal places for seconds.
        iso_str = date_obj.isoformat(timespec='milliseconds')
        return iso_str.replace('+00:00', 'Z')
    return None