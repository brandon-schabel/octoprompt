import os

def expand_tilde(path: str) -> str:
    """Expands tilde (~) in a path to the user's home directory."""
    return os.path.expanduser(path)

def resolve_path(path: str) -> str:
    """Resolves a path, expanding tilde if present, to an absolute path."""
    return os.path.abspath(expand_tilde(path))

def normalize_path_for_db(path: str) -> str:
    """Normalizes a path for database storage (uses forward slashes)."""
    return path.replace("\\\\", "/")
