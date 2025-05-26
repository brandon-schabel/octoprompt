from typing import Any, Dict

def merge_deep(*objects: Dict[str, Any]) -> Dict[str, Any]:
    if not objects: return {}
    result: Dict[str, Any] = {}

    for obj in objects:
        if not isinstance(obj, dict): continue

        for key, value in obj.items():
            if isinstance(value, dict):
                if key in result and isinstance(result[key], dict):
                    result[key] = merge_deep(result[key], value)
                else:
                    result[key] = merge_deep({}, value)
            else:
                result[key] = value
    return result