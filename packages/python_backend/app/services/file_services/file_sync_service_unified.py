import asyncio
import hashlib
import os
import time
from enum import Enum
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any, Tuple, Set, Union, Literal
import threading

from pydantic import BaseModel, Field
import pathspec
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

import aiofiles
import aiofiles.os
try:
    import xxhash
    USE_XXHASH = True
except ImportError:
    USE_XXHASH = False

from app.schemas.project_schemas import Project, ProjectFile, FileSyncData
from app.services.project_service import (
    get_project_files,
    bulk_create_project_files,
    bulk_update_project_files,
    bulk_delete_project_files,
    list_projects,
    summarize_single_file,
    BulkUpdateItem
)
from app.services.project_service import Project as ProjectSchema

PERFORMANCE_CONFIG = {
    "small_project_threshold": 100,
    "medium_project_threshold": 1000,
    "small_concurrency": 10,
    "medium_concurrency": 25,
    "large_concurrency": 50,
    "small_chunk_size": 50,
    "medium_chunk_size": 100,
    "large_chunk_size": 200,
    "max_file_size": 10 * 1024 * 1024,
}

ALLOWED_FILE_CONFIGS: List[str] = [
    '.txt', '.md', '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.yaml', '.yml', '.md', '.mdx',
    '.xml', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rb', '.php', '.swift',
    '.kt', '.scala', '.rs', '.lua', '.pl', '.sh', '.bash', '.zsh', '.fish',
    '.dockerfile', 'dockerfile', '.env', 'readme.md', 'license', '.gitignore'
]
DEFAULT_FILE_EXCLUSIONS: List[str] = [
    '*.log', '*.tmp', '*.swp', '*.swo', '*.bak', '*.lock',
    '__pycache__/', '.cache/', '*.pyc', '*.pyo', '*.pyd',
    '.idea/', '.vscode/', '.history/',
    'node_modules/', 'dist/', 'build/', 'target/', 'out/', 'bin/', 'obj/',
    '.git/', '.svn/', '.hg/',
    '.DS_Store', 'Thumbs.db'
]
CRITICAL_EXCLUDED_DIRS: Set[str] = {
    'node_modules', '.git', 'dist', 'build', 'venv', '.DS_Store',
    '__pycache__', '.cache', 'target', 'out', 'bin', 'obj', '.idea', '.vscode'
}
DEBOUNCE_DELAY_SECONDS = 2.0

_global_semaphore: Optional[asyncio.Semaphore] = None
_performance_stats = {
    "total_syncs": 0,
    "total_files_processed": 0,
    "total_time": 0.0,
    "sync_times": []
}

def get_performance_config(file_count: int) -> Dict[str, int]:
    if file_count < PERFORMANCE_CONFIG["small_project_threshold"]:
        return {
            "concurrency": PERFORMANCE_CONFIG["small_concurrency"],
            "chunk_size": PERFORMANCE_CONFIG["small_chunk_size"]
        }
    elif file_count < PERFORMANCE_CONFIG["medium_project_threshold"]:
        return {
            "concurrency": PERFORMANCE_CONFIG["medium_concurrency"],
            "chunk_size": PERFORMANCE_CONFIG["medium_chunk_size"]
        }
    else:
        return {
            "concurrency": PERFORMANCE_CONFIG["large_concurrency"],
            "chunk_size": PERFORMANCE_CONFIG["large_chunk_size"]
        }

def get_global_semaphore(concurrency: int = 25) -> asyncio.Semaphore:
    global _global_semaphore
    if _global_semaphore is None or _global_semaphore._value != concurrency:
        _global_semaphore = asyncio.Semaphore(concurrency)
    return _global_semaphore

class FileChangeEvent(str, Enum):
    CREATED = 'created'
    MODIFIED = 'modified'
    DELETED = 'deleted'

def resolve_path_py(path_str: str) -> Path:
    return Path(path_str).resolve()

def normalize_path_for_db(path_str: Union[str, Path]) -> str:
    return str(path_str).replace('\\\\', '/')

FileChangeListener = Callable[[FileChangeEvent, str], Any]

class WatchOptions(BaseModel):
    directory: str
    ignore_patterns: List[str] = Field(default_factory=list)
    recursive: bool = True

def is_path_ignored_by_custom_patterns(relative_file_path: str, custom_ignore_patterns: List[str]) -> bool:
    import fnmatch
    for pattern_str in custom_ignore_patterns:
        if fnmatch.fnmatch(relative_file_path, pattern_str) or fnmatch.fnmatch(Path(relative_file_path).name, pattern_str):
            return True
    return False

class _UnifiedFileSystemEventHandler(FileSystemEventHandler):
    def __init__(self, base_path: Path, listeners: List[FileChangeListener], project_root: Path, spec: Optional[pathspec.PathSpec], custom_ignore_patterns: List[str]):
        super().__init__()
        self.base_path = base_path
        self.listeners = listeners
        self.project_root = project_root
        self.spec = spec
        self.custom_ignore_patterns = custom_ignore_patterns

    def _dispatch_event(self, event_type: FileChangeEvent, path_str: str):
        for listener in self.listeners:
            try:
                listener(event_type, path_str)
            except Exception as e:
                pass

    def _process_event(self, event_type: FileChangeEvent, path_str: str):
        full_path = Path(path_str)
        try:
            relative_path_to_project_root = normalize_path_for_db(full_path.relative_to(self.project_root))

            if any(part in CRITICAL_EXCLUDED_DIRS for part in Path(relative_path_to_project_root).parts):
                return
            if is_path_ignored_by_custom_patterns(relative_path_to_project_root, self.custom_ignore_patterns):
                return
            if self.spec and self.spec.match_file(relative_path_to_project_root):
                return

            self._dispatch_event(event_type, str(full_path))
        except (ValueError, Exception):
            pass

    def on_any_event(self, event: FileSystemEvent):
        if event.is_directory:
            return

        src_path_obj = Path(event.src_path)
        if src_path_obj.name in CRITICAL_EXCLUDED_DIRS:
            return

        event_map = {
            'created': FileChangeEvent.CREATED,
            'modified': FileChangeEvent.MODIFIED,
            'deleted': FileChangeEvent.DELETED,
        }

        if event.event_type in event_map:
            self._process_event(event_map[event.event_type], event.src_path)
        elif event.event_type == 'moved':
            dest_path_obj = Path(event.dest_path)
            if dest_path_obj.name in CRITICAL_EXCLUDED_DIRS:
                return
            self._process_event(FileChangeEvent.DELETED, event.src_path)
            if not dest_path_obj.is_dir():
                self._process_event(FileChangeEvent.CREATED, event.dest_path)

def create_file_change_plugin():
    internal_watcher_ctrl = create_file_change_watcher()
    current_project_ref: Optional[ProjectSchema] = None

    plugin_loop: Optional[asyncio.AbstractEventLoop] = None
    plugin_thread: Optional[threading.Thread] = None
    _debounce_timer: Optional[asyncio.TimerHandle] = None
    _pending_changes: Set[Tuple[FileChangeEvent, str]] = set()

    def _run_plugin_event_loop():
        nonlocal plugin_loop
        if plugin_loop:
            asyncio.set_event_loop(plugin_loop)
            try:
                plugin_loop.run_forever()
            finally:
                plugin_loop.close()

    def _ensure_plugin_loop_is_running():
        nonlocal plugin_loop, plugin_thread
        if plugin_loop is None or not plugin_loop.is_running():
            if plugin_thread and plugin_thread.is_alive():
                return
            if plugin_loop and not plugin_loop.is_closed():
                plugin_loop.close()

            plugin_loop = asyncio.new_event_loop()
            thread_name = f"PluginLoop-{current_project_ref.id if current_project_ref else 'Unknown'}"
            plugin_thread = threading.Thread(target=_run_plugin_event_loop, daemon=True, name=thread_name)
            plugin_thread.start()

    async def _process_debounced_changes():
        nonlocal _pending_changes
        if not current_project_ref or not _pending_changes:
            _pending_changes.clear()
            return

        changes_to_process = list(_pending_changes)
        _pending_changes.clear()
        project_id = current_project_ref.id

        try:
            await sync_project(current_project_ref)
            all_files_in_db = await get_project_files(project_id)
            if not all_files_in_db:
                return

            abs_project_path = resolve_path_py(current_project_ref.path)
            for event_type, path_str in changes_to_process:
                if event_type == FileChangeEvent.DELETED:
                    continue
                try:
                    relative_changed_path = normalize_path_for_db(Path(path_str).relative_to(abs_project_path))
                    updated_file_in_db = next((f for f in all_files_in_db if normalize_path_for_db(f.path) == relative_changed_path), None)
                    if updated_file_in_db:
                        await summarize_single_file(updated_file_in_db)
                except (ValueError, Exception):
                    continue
        except Exception:
            pass

    def schedule_debounced_file_handling(event: FileChangeEvent, path_str: str):
        nonlocal _debounce_timer, _pending_changes
        if not plugin_loop or not plugin_loop.is_running():
            if current_project_ref:
                _ensure_plugin_loop_is_running()
            if not plugin_loop or not plugin_loop.is_running():
                return

        _pending_changes.add((event, path_str))

        if _debounce_timer:
            _debounce_timer.cancel()

        _debounce_timer = plugin_loop.call_later(
            DEBOUNCE_DELAY_SECONDS,
            lambda: asyncio.run_coroutine_threadsafe(_process_debounced_changes(), plugin_loop)
        )

    async def start_plugin(project: ProjectSchema, ignore_patterns: List[str] = []):
        nonlocal current_project_ref
        current_project_ref = project
        _ensure_plugin_loop_is_running()
        internal_watcher_ctrl["register_listener"](schedule_debounced_file_handling)
        project_abs_path_str = str(resolve_path_py(project.path))
        internal_watcher_ctrl["start_watching"](
            WatchOptions(directory=project_abs_path_str, ignore_patterns=ignore_patterns, recursive=True),
            project_abs_path_str
        )

    def stop_plugin():
        nonlocal current_project_ref, plugin_loop, plugin_thread, _debounce_timer, _pending_changes
        internal_watcher_ctrl["stop_all_and_clear_listeners"]()
        if _debounce_timer:
            _debounce_timer.cancel()
        _pending_changes.clear()

        if plugin_loop and plugin_loop.is_running():
            plugin_loop.call_soon_threadsafe(plugin_loop.stop)
        if plugin_thread and plugin_thread.is_alive():
            plugin_thread.join(timeout=5)

        plugin_loop = None
        plugin_thread = None
        current_project_ref = None

    return {"start": start_plugin, "stop": stop_plugin}

def create_watchers_manager():
    active_plugins_map: Dict[int, Dict[str, Any]] = {}

    async def start_watching_project(project: ProjectSchema, ignore_patterns: List[str] = []):
        if project.id in active_plugins_map:
            return

        resolved_project_path = resolve_path_py(project.path)
        if not resolved_project_path.is_dir():
            return

        plugin = create_file_change_plugin()
        try:
            await plugin["start"](project, ignore_patterns)
            active_plugins_map[project.id] = plugin
        except Exception:
            plugin["stop"]()

    def stop_watching_project(project_id: int):
        plugin = active_plugins_map.pop(project_id, None)
        if plugin:
            plugin["stop"]()

    def stop_all_watchers():
        for project_id in list(active_plugins_map.keys()):
            stop_watching_project(project_id)

    return {
        "start_watching_project": start_watching_project,
        "stop_watching_project": stop_watching_project,
        "stop_all_watchers": stop_all_watchers
    }

def configure_performance(**kwargs):
    global PERFORMANCE_CONFIG, _global_semaphore
    PERFORMANCE_CONFIG.update(kwargs)
    _global_semaphore = None

def tune_for_system(cpu_cores: Optional[int] = None, available_ram_gb: Optional[float] = None, storage_type: str = "ssd"):
    cpu_cores = cpu_cores or os.cpu_count() or 4
    available_ram_gb = available_ram_gb or 8.0

    base_concurrency = min(cpu_cores * 2, 50)
    if storage_type.lower() == "hdd":
        base_concurrency = max(base_concurrency // 2, 5)

    chunk_multiplier = 1.0
    if available_ram_gb < 4:
        chunk_multiplier = 0.5
    elif available_ram_gb > 16:
        chunk_multiplier = 2.0

    configure_performance(
        small_concurrency=max(base_concurrency // 4, 5),
        medium_concurrency=max(base_concurrency // 2, 10),
        large_concurrency=base_concurrency,
        small_chunk_size=int(50 * chunk_multiplier),
        medium_chunk_size=int(100 * chunk_multiplier),
        large_chunk_size=int(200 * chunk_multiplier)
    )

def create_file_change_watcher():
    observer_ref: Optional[Observer] = None
    listeners_ref: List[FileChangeListener] = []

    def register_listener(listener: FileChangeListener):
        if listener not in listeners_ref:
            listeners_ref.append(listener)

    def unregister_listener(listener: FileChangeListener):
        if listener in listeners_ref:
            listeners_ref.remove(listener)

    def start_watching(options: WatchOptions, project_reference_root_str: str):
        nonlocal observer_ref
        resolved_dir_to_watch = resolve_path_py(options.directory)
        
        if observer_ref and observer_ref.is_alive():
            if getattr(observer_ref, '__watching_directory', None) == resolved_dir_to_watch:
                return
            stop_watching()

        if not resolved_dir_to_watch.is_dir():
            return
        
        project_root_for_ignores = resolve_path_py(project_reference_root_str)
        pathspec_rules = load_ignore_rules_sync(str(project_root_for_ignores))

        event_handler = _UnifiedFileSystemEventHandler(
            resolved_dir_to_watch,
            listeners_ref,
            project_root_for_ignores,
            pathspec_rules,
            options.ignore_patterns or []
        )
        new_observer = Observer()
        new_observer.schedule(event_handler, str(resolved_dir_to_watch), recursive=options.recursive)
        
        try:
            new_observer.start()
            observer_ref = new_observer
            setattr(observer_ref, '__watching_directory', resolved_dir_to_watch)
        except Exception:
            observer_ref = None

    def stop_watching():
        nonlocal observer_ref
        if observer_ref and observer_ref.is_alive():
            observer_ref.stop()
            observer_ref.join(timeout=2)
        observer_ref = None

    def stop_all_and_clear_listeners():
        stop_watching()
        listeners_ref.clear()

    return {
        "register_listener": register_listener,
        "unregister_listener": unregister_listener,
        "start_watching": start_watching,
        "stop_watching": stop_watching,
        "stop_all_and_clear_listeners": stop_all_and_clear_listeners,
        "get_listeners": lambda: list(listeners_ref)
    }

def compute_checksum(content: bytes) -> str:
    if USE_XXHASH:
        return xxhash.xxh64(content).hexdigest()
    else:
        return hashlib.sha256(content).hexdigest()

async def compute_checksum_async(content: bytes) -> str:
    return await asyncio.get_event_loop().run_in_executor(None, compute_checksum, content)

def is_valid_checksum(checksum: Optional[str]) -> bool:
    return isinstance(checksum, str) and len(checksum) == 16 and all(c in '0123456789abcdef' for c in checksum) or \
           isinstance(checksum, str) and len(checksum) == 64 and all(c in '0123456789abcdef' for c in checksum)

def load_ignore_rules_sync(project_root_str: str) -> Optional[pathspec.PathSpec]:
    project_root = Path(project_root_str)
    patterns = list(DEFAULT_FILE_EXCLUSIONS)
    gitignore_path = project_root / '.gitignore'
    if gitignore_path.is_file():
        try:
            with open(gitignore_path, 'r', encoding='utf-8', errors='ignore') as f:
                patterns.extend(f.read().splitlines())
        except Exception:
            pass
    
    if not patterns:
        return None
    try:
        return pathspec.PathSpec.from_lines('gitwildmatch', patterns)
    except Exception:
        return None

async def load_ignore_rules(project_root_str: str) -> Optional[pathspec.PathSpec]:
    return load_ignore_rules_sync(project_root_str)

async def process_single_file_async(
    abs_file_path: Path,
    absolute_project_path: Path,
    semaphore: asyncio.Semaphore
) -> Optional[Tuple[str, FileSyncData]]:
    async with semaphore:
        try:
            stat_info = await aiofiles.os.stat(abs_file_path)
            if stat_info.st_size > PERFORMANCE_CONFIG["max_file_size"]:
                return None
            
            async with aiofiles.open(abs_file_path, 'rb') as f:
                content_bytes = await f.read()
            
            content_str = content_bytes.decode('utf-8', errors='ignore')
            checksum = compute_checksum(content_bytes)
            
            file_data = FileSyncData(
                path=normalize_path_for_db(abs_file_path.relative_to(absolute_project_path)),
                name=abs_file_path.name,
                extension=abs_file_path.suffix.lower() or None,
                content=content_str,
                size=stat_info.st_size,
                checksum=checksum
            )
            return file_data.path, file_data
        except Exception:
            return None

async def process_file_batch_async(
    file_paths: List[Path],
    absolute_project_path: Path,
    concurrency: int
) -> List[Tuple[str, FileSyncData]]:
    semaphore = get_global_semaphore(concurrency)
    tasks = [process_single_file_async(fp, absolute_project_path, semaphore) for fp in file_paths]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if r and not isinstance(r, Exception)]

def get_text_files(
    dir_path_str: str,
    project_root_str: str,
    spec: Optional[pathspec.PathSpec],
    allowed_configs: List[str] = ALLOWED_FILE_CONFIGS
) -> List[str]:
    files_found: List[str] = []
    start_dir = Path(dir_path_str)
    project_root = Path(project_root_str)

    for root, dirs, files in os.walk(start_dir, topdown=True):
        current_dir_path = Path(root)
        
        dirs[:] = [d for d in dirs if d not in CRITICAL_EXCLUDED_DIRS and not (spec and spec.match_file(normalize_path_for_db(current_dir_path / d).relative_to(project_root)))]

        for filename in files:
            file_path_obj = current_dir_path / filename
            relative_file = normalize_path_for_db(file_path_obj.relative_to(project_root))

            if filename in CRITICAL_EXCLUDED_DIRS or (spec and spec.match_file(relative_file)):
                continue
            
            file_ext = file_path_obj.suffix.lower()
            if (file_ext in allowed_configs) or (filename in allowed_configs) or (not file_ext and file_path_obj.name in allowed_configs):
                try:
                    if file_path_obj.is_file() and file_path_obj.stat().st_size < PERFORMANCE_CONFIG["max_file_size"]:
                        files_found.append(str(file_path_obj.resolve()))
                except (FileNotFoundError, Exception):
                    pass
    return files_found

async def sync_file_set_optimized(
    project: Project,
    absolute_project_path: Path,
    absolute_file_paths_on_disk: List[str],
    spec: Optional[pathspec.PathSpec]
) -> Dict[str, int]:
    total_files = len(absolute_file_paths_on_disk)
    perf_config = get_performance_config(total_files)
    
    existing_db_files = await get_project_files(project.id)
    if existing_db_files is None:
        raise ConnectionError(f"Could not retrieve files for project {project.id}")
    
    db_file_map = {normalize_path_for_db(f.path): f for f in existing_db_files}
    file_paths = [Path(path) for path in absolute_file_paths_on_disk]
    
    processed_files_map = {}
    for i in range(0, len(file_paths), perf_config["chunk_size"]):
        chunk = file_paths[i:i + perf_config["chunk_size"]]
        chunk_results = await process_file_batch_async(chunk, absolute_project_path, perf_config["concurrency"])
        for relative_path, file_data in chunk_results:
            processed_files_map[relative_path] = file_data
    
    files_to_create_data: List[FileSyncData] = []
    files_to_update_data: List[BulkUpdateItem] = []
    skipped_count = 0

    for relative_path, file_data in processed_files_map.items():
        existing_db_file = db_file_map.get(relative_path)
        if existing_db_file:
            if not is_valid_checksum(existing_db_file.checksum) or existing_db_file.checksum != file_data.checksum:
                files_to_update_data.append(BulkUpdateItem(fileId=existing_db_file.id, data=file_data))
            else:
                skipped_count += 1
            db_file_map.pop(relative_path, None)
        else:
            files_to_create_data.append(file_data)
            
    file_ids_to_delete = [db_file.id for db_file in db_file_map.values()]

    try:
        created_count = len(await bulk_create_project_files(project.id, files_to_create_data)) if files_to_create_data else 0
        updated_count = len(await bulk_update_project_files(project.id, files_to_update_data)) if files_to_update_data else 0
        delete_result = await bulk_delete_project_files(project.id, file_ids_to_delete) if file_ids_to_delete else {"deleted_count": 0}
        deleted_count = delete_result.get("deleted_count", 0)
        
        return {"created": created_count, "updated": updated_count, "deleted": deleted_count, "skipped": skipped_count}
    except Exception as e:
        raise ConnectionError(f"Sync failed during storage ops for {project.id}: {e}")

async def sync_file_set(project: Project, absolute_project_path: Path, absolute_file_paths_on_disk: List[str], spec: Optional[pathspec.PathSpec]) -> Dict[str, int]:
    return await sync_file_set_optimized(project, absolute_project_path, absolute_file_paths_on_disk, spec)

async def sync_project(project: Project) -> Dict[str, int]:
    try:
        abs_project_path = resolve_path_py(project.path)
        if not abs_project_path.is_dir():
            raise ValueError(f"Project path is not a valid directory: {project.path}")

        pathspec_rules = await load_ignore_rules(str(abs_project_path))
        project_files_on_disk = get_text_files(str(abs_project_path), str(abs_project_path), pathspec_rules, ALLOWED_FILE_CONFIGS)
        
        return await sync_file_set_optimized(project, abs_project_path, project_files_on_disk, pathspec_rules)
    except Exception as e:
        raise

async def sync_project_folder(project: Project, folder_path_relative: str) -> Dict[str, int]:
    try:
        abs_project_path = resolve_path_py(project.path)
        abs_folder_to_sync = (abs_project_path / folder_path_relative).resolve()

        if not abs_folder_to_sync.is_dir():
            raise ValueError(f"Folder path is not valid: {folder_path_relative}")
        
        pathspec_rules = await load_ignore_rules(str(abs_project_path))
        
        folder_files_on_disk = get_text_files(str(abs_folder_to_sync), str(abs_project_path), pathspec_rules, ALLOWED_FILE_CONFIGS)
        return await sync_file_set(project, abs_project_path, folder_files_on_disk, pathspec_rules)
    except Exception as e:
        raise

async def benchmark_sync_performance(project: Project, iterations: int = 3) -> Dict[str, Any]:
    times = []
    results = []
    for i in range(iterations):
        start = time.time()
        result = await sync_project(project)
        duration = time.time() - start
        times.append(duration)
        results.append(result)
        if i < iterations - 1:
            await asyncio.sleep(1)
            
    avg_time = sum(times) / len(times)
    total_avg_files = sum(sum(r.values()) for r in results) / len(results)
    
    return {
        "average_time": avg_time,
        "best_time": min(times),
        "worst_time": max(times),
        "average_files": {k: sum(r.get(k, 0) for r in results) / len(results) for k in ["created", "updated", "deleted", "skipped"]},
        "total_average_files": total_avg_files,
        "average_rate": total_avg_files / avg_time if avg_time > 0 else 0,
        "iterations": iterations
    }

def get_performance_stats() -> Dict[str, Any]:
    global _performance_stats
    stats = _performance_stats.copy()
    total_syncs = stats.get("total_syncs", 0)
    
    if total_syncs > 0:
        stats["average_time_per_sync"] = stats["total_time"] / total_syncs
        stats["average_files_per_sync"] = stats["total_files_processed"] / total_syncs
    else:
        stats["average_time_per_sync"] = 0
        stats["average_files_per_sync"] = 0
    
    sync_times = stats.get("sync_times", [])
    if sync_times:
        stats["recent_average_time"] = sum(sync_times) / len(sync_times)
    else:
        stats["recent_average_time"] = 0
    
    return stats

def reset_performance_stats():
    global _performance_stats
    _performance_stats = {
        "total_syncs": 0,
        "total_files_processed": 0,
        "total_time": 0.0,
        "sync_times": []
    }