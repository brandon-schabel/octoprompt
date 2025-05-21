# packages/python_backend/app/utils/merge_deep.py
# Last 5 changes:
# 1. Initial Python migration from TypeScript's merge-deep.ts.
# 2. Ensured handling of multiple source dictionaries as arguments.
# 3. Maintained recursive merging logic for nested dictionaries.
# 4. Ensured that arrays and primitive values from later objects overwrite earlier ones.
# 5. Added type hinting for clarity and static analysis.

from typing import Any, Dict

def merge_deep(*objects: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively merges two or more dictionaries.
    Non-dictionary items in the `objects` argument list are skipped.
    For keys with dictionary values, a deep merge is performed.
    For keys with non-dictionary values (like primitives or lists), the value
    from the latest object in the sequence overwrites any previous value.
    """
    if not objects: return {}
    result: Dict[str, Any] = {}

    for obj in objects:
        if not isinstance(obj, dict): continue # Skip non-dict inputs

        for key, value in obj.items():
            if isinstance(value, dict):
                # If key points to a dict in both result and current obj, merge them
                if key in result and isinstance(result[key], dict):
                    result[key] = merge_deep(result[key], value)
                else:
                    # Otherwise, deep copy the new dict value into result
                    result[key] = merge_deep({}, value)
            else:
                # For non-dict values (primitives, lists), overwrite
                result[key] = value
    return result