import math
from datetime import datetime, timezone
from typing import Any, Optional

try:
    from dateutil.parser import parse as dateutil_parse
    HAS_DATEUTIL = True
except ImportError:
    HAS_DATEUTIL = False
    dateutil_parse = None

NUMERIC_TIMESTAMP_MS_THRESHOLD = 10**11

def parse_timestamp(ts_value: Any) -> Optional[datetime]:
    if ts_value is None or isinstance(ts_value, bool):
        return None

    if isinstance(ts_value, datetime):
        return ts_value.astimezone(timezone.utc) if ts_value.tzinfo else ts_value.replace(tzinfo=timezone.utc)

    if isinstance(ts_value, (int, float)):
        if math.isnan(ts_value): return None
        try:
            ms_equivalent = ts_value if ts_value > NUMERIC_TIMESTAMP_MS_THRESHOLD else ts_value * 1000
            return datetime.fromtimestamp(ms_equivalent / 1000.0, tz=timezone.utc)
        except (ValueError, OverflowError, OSError): return None

    if isinstance(ts_value, str):
        val = ts_value.strip()
        if not val: return None
        
        parsed_dt: Optional[datetime] = None
        if HAS_DATEUTIL and dateutil_parse:
            try: parsed_dt = dateutil_parse(val)
            except (ValueError, OverflowError, TypeError): pass
        
        if not parsed_dt:
            try:
                iso_val = val.replace(' ', 'T', 1) if 'T' not in val and ' ' in val else val
                if iso_val.endswith('Z'):
                    parsed_dt = datetime.fromisoformat(iso_val[:-1]).replace(tzinfo=timezone.utc)
                else:
                    parsed_dt = datetime.fromisoformat(iso_val)
            except ValueError: pass

        if parsed_dt:
            return parsed_dt.astimezone(timezone.utc) if parsed_dt.tzinfo else parsed_dt.replace(tzinfo=timezone.utc)
            
    return None

def normalize_to_iso_string(ts_value: Any) -> Optional[str]:
    date_obj = parse_timestamp(ts_value)
    if date_obj:
        iso_str = date_obj.isoformat(timespec='milliseconds')
        return iso_str.replace('+00:00', 'Z')
    return None