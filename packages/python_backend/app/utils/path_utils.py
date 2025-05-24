import os

def expand_tilde(path: str) -> str:
    return os.path.expanduser(path)

def resolve_path(path: str) -> str:
    return os.path.abspath(expand_tilde(path))

def normalize_path_for_db(path: str) -> str:
    return path.replace("\\\\", "/")