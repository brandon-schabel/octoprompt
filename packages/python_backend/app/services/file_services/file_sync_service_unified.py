import asyncio
import hashlib
import os
import time
from enum import Enum
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any, Tuple, Set, Union, Literal
import threading

from pydantic import BaseModel, Field
import ignore # Python's 'ignore' library, similar to 'ignore' in JS
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent, \
    FileModifiedEvent, FileCreatedEvent, FileDeletedEvent, DirModifiedEvent, DirCreatedEvent, DirDeletedEvent

# --- Type Definitions (Mirrored from TS) ---

# Assuming these Pydantic schemas exist or will be created in the Python project:
# from app.schemas.project_schemas import Project, ProjectFile # (Pydantic Models)
# from app.services.project_service import ( # Python equivalents
#     get_project_files,
#     bulk_create_project_files,
#     bulk_update_project_files,
#     bulk_delete_project_files,
#     list_projects,
#     summarize_single_file,
#     FileSyncData # This would be a Pydantic model or TypedDict
# )

# --- Mocks/Placeholders for project_service and schemas (replace with actual) ---
class Project(BaseModel):
    id: str
    name: str
    path: str # Absolute path to project root

class ProjectFile(BaseModel):
    id: str
    path: str # Relative to project root
    name: str
    extension: Optional[str] = None
    content: Optional[str] = None # May not always be loaded
    size: int
    checksum: Optional[str] = None

class FileSyncData(BaseModel): # For bulk operations
    path: str
    name: str
    extension: Optional[str] = None
    content: str
    size: int
    checksum: str

# Mock project service functions
MOCK_DB_PROJECT_FILES: Dict[str, List[ProjectFile]] = {}
MOCK_PROJECTS: List[Project] = []

async def get_project_files(project_id: str) -> Optional[List[ProjectFile]]:
    print(f"[MockProjectService] Getting files for project {project_id}")
    return MOCK_DB_PROJECT_FILES.get(project_id, [])

async def bulk_create_project_files(project_id: str, files_data: List[FileSyncData]) -> List[ProjectFile]:
    print(f"[MockProjectService] Creating {len(files_data)} files for project {project_id}")
    if project_id not in MOCK_DB_PROJECT_FILES:
        MOCK_DB_PROJECT_FILES[project_id] = []
    
    created_files = []
    for data in files_data:
        new_id = f"file_{os.urandom(4).hex()}"
        pf = ProjectFile(id=new_id, path=data.path, name=data.name, extension=data.extension, size=data.size, checksum=data.checksum, content=data.content)
        MOCK_DB_PROJECT_FILES[project_id].append(pf)
        created_files.append(pf)
    return created_files

async def bulk_update_project_files(project_id: str, files_to_update: List[Dict[str, Any]]) -> List[ProjectFile]: # files_to_update: [{fileId: str, data: FileSyncData}]
    print(f"[MockProjectService] Updating {len(files_to_update)} files for project {project_id}")
    updated_files = []
    if project_id in MOCK_DB_PROJECT_FILES:
        for update_item in files_to_update:
            file_id = update_item['fileId'] # Assuming key is 'fileId' as in TS
            data = FileSyncData.model_validate(update_item['data'])
            for i, pf in enumerate(MOCK_DB_PROJECT_FILES[project_id]):
                if pf.id == file_id:
                    updated_pf = pf.model_copy(update=data.model_dump(exclude_none=True))
                    MOCK_DB_PROJECT_FILES[project_id][i] = updated_pf
                    updated_files.append(updated_pf)
                    break
    return updated_files

async def bulk_delete_project_files(project_id: str, file_ids: List[str]) -> Dict[str, int]:
    print(f"[MockProjectService] Deleting {len(file_ids)} files for project {project_id}")
    deleted_count = 0
    if project_id in MOCK_DB_PROJECT_FILES:
        initial_len = len(MOCK_DB_PROJECT_FILES[project_id])
        MOCK_DB_PROJECT_FILES[project_id] = [pf for pf in MOCK_DB_PROJECT_FILES[project_id] if pf.id not in file_ids]
        deleted_count = initial_len - len(MOCK_DB_PROJECT_FILES[project_id])
    return {"deletedCount": deleted_count}

async def list_projects() -> List[Project]:
    print("[MockProjectService] Listing projects")
    return MOCK_PROJECTS

async def summarize_single_file(file: ProjectFile) -> None:
    print(f"[MockProjectService] Summarizing file {file.path} (ID: {file.id})")
    await asyncio.sleep(0.1) # Simulate async work

# --- Constants (Mirrored from TS) ---
ALLOWED_FILE_CONFIGS: List[str] = [
    '.txt', '.md', '.py', '.js', '.ts', '.html', '.css', '.json', '.yaml', '.yml',
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
    'node_modules', '.git', 'dist', 'build', '.vscode', '.idea', 'venv', '.DS_Store',
    '__pycache__', '.cache', 'target', 'out', 'bin', 'obj'
}


# --- FileChangeEvent Enum ---
class FileChangeEvent(str, Enum):
    CREATED = 'created'
    MODIFIED = 'modified'
    DELETED = 'deleted'

# --- Path Utils (Mirrored from TS utils) ---
def resolve_path_py(path_str: str) -> Path: # Renamed to avoid conflict
    return Path(path_str).resolve()

def normalize_path_for_db(path_str: Union[str, Path]) -> str:
    return str(path_str).replace('\\\\', '/')

# --- File Watcher Logic ---
FileChangeListener = Callable[[FileChangeEvent, str], Any] # async or sync

class WatchOptions(BaseModel):
    directory: str
    ignore_patterns: List[str] = Field(default_factory=list)
    recursive: bool = True

def is_path_ignored_by_custom_patterns(relative_file_path: str, custom_ignore_patterns: List[str]) -> bool:
    import fnmatch
    # Check against custom ignore patterns (simple globs on relative path or filename)
    for pattern_str in custom_ignore_patterns:
        if fnmatch.fnmatch(relative_file_path, pattern_str) or fnmatch.fnmatch(Path(relative_file_path).name, pattern_str):
            return True
    return False

class _UnifiedFileSystemEventHandler(FileSystemEventHandler):
    def __init__(self, base_path: Path, listeners: List[FileChangeListener], project_root: Path, ig: ignore.Ignore, custom_ignore_patterns: List[str]):
        super().__init__()
        self.base_path = base_path # The directory being watched
        self.listeners = listeners
        self.project_root = project_root # Project root for relative path calculations for .gitignore
        self.ig = ig # ignore.Ignore instance for .gitignore rules
        self.custom_ignore_patterns = custom_ignore_patterns # Additional explicit ignore patterns

    def _dispatch_event(self, event_type: FileChangeEvent, path_str: str):
        # This method is called by watchdog, runs in watchdog's thread.
        # It needs to schedule the async listener execution into an asyncio event loop.
        loop = asyncio.get_event_loop() # Try to get current thread's loop or main if policy set
        for listener in self.listeners:
            if asyncio.iscoroutinefunction(listener):
                if loop.is_running():
                    asyncio.run_coroutine_threadsafe(listener(event_type, path_str), loop)
                else:
                    # Fallback: This might not be ideal if no loop is readily available or if it starts/stops frequently.
                    # print(f"[FSWatcher-WARN] Event loop not running for listener. Running in new loop for {path_str}")
                    asyncio.run(listener(event_type, path_str))
            else: # Synchronous listener
                try:
                    listener(event_type, path_str)
                except Exception as e:
                    print(f"[FSWatcher] Error in synchronous listener for {path_str}: {e}")

    def _process_event(self, event_type: FileChangeEvent, path_str: str):
        full_path = Path(path_str)
        try:
            # Path relative to project root for ignore checking
            relative_path_to_project_root = normalize_path_for_db(full_path.relative_to(self.project_root))
            
            if self.ig.ignores(relative_path_to_project_root) or \
               is_path_ignored_by_custom_patterns(relative_path_to_project_root, self.custom_ignore_patterns) or \
               any(part in CRITICAL_EXCLUDED_DIRS for part in Path(relative_path_to_project_root).parts):
                return

            self._dispatch_event(event_type, str(full_path))

        except ValueError: # If full_path is not relative to self.project_root (e.g. temp files outside)
            # print(f"[FSWatcher] Path {full_path} not relative to project root {self.project_root}. Might be temp file.")
            pass # Ignore if not relative to project root (e.g., some temp files created by OS/editors)
        except Exception as e:
            print(f"[FSWatcher] Error processing event {event_type} for {path_str}: {e}")

    def on_created(self, event: FileSystemEvent): # Catches FileCreatedEvent and DirCreatedEvent
        if Path(event.src_path).name in CRITICAL_EXCLUDED_DIRS: return
        self._process_event(FileChangeEvent.CREATED, event.src_path)

    def on_modified(self, event: FileSystemEvent):
        if isinstance(event, FileModifiedEvent): # Only care about file modifications
             if Path(event.src_path).name in CRITICAL_EXCLUDED_DIRS: return
             self._process_event(FileChangeEvent.MODIFIED, event.src_path)

    def on_deleted(self, event: FileSystemEvent):
        if Path(event.src_path).name in CRITICAL_EXCLUDED_DIRS: return
        self._process_event(FileChangeEvent.DELETED, event.src_path)

    def on_moved(self, event: FileSystemEvent): # Represents rename
        src_path_obj = Path(event.src_path)
        dest_path_obj = Path(event.dest_path)
        
        if src_path_obj.name in CRITICAL_EXCLUDED_DIRS or dest_path_obj.name in CRITICAL_EXCLUDED_DIRS: return

        # Process as delete from src_path
        self._process_event(FileChangeEvent.DELETED, event.src_path)
        # Process as create for dest_path (if it's not ignored)
        self._process_event(FileChangeEvent.CREATED, event.dest_path)


def create_file_change_watcher():
    observer_ref: Optional[Observer] = None
    listeners_ref: List[FileChangeListener] = []
    # project_root_for_watcher_ref etc. are part of the closure of start_watching

    def register_listener(listener: FileChangeListener):
        if listener not in listeners_ref:
            listeners_ref.append(listener)

    def unregister_listener(listener: FileChangeListener):
        if listener in listeners_ref:
            listeners_ref.remove(listener)

    def start_watching(options: WatchOptions, project_reference_root_str: str):
        nonlocal observer_ref
        
        resolved_dir_to_watch = resolve_path_py(options.directory)
        project_root_for_ignores = resolve_path_py(project_reference_root_str)
        current_custom_ignore_patterns = options.ignore_patterns or []

        if observer_ref and observer_ref.is_alive() and hasattr(observer_ref, '__watching_directory') and observer_ref.__watching_directory == resolved_dir_to_watch:
            # print(f"[FSWatcher] Already watching: {resolved_dir_to_watch}")
            return
        if observer_ref and observer_ref.is_alive():
            stop_watching() # Stop previous before starting new

        if not resolved_dir_to_watch.is_dir():
            print(f"[FSWatcher] Directory does not exist or is not a dir: {resolved_dir_to_watch}")
            return
        
        current_ignore_rules = load_ignore_rules_sync(str(project_root_for_ignores))

        new_observer = Observer()
        event_handler = _UnifiedFileSystemEventHandler(
            resolved_dir_to_watch, 
            listeners_ref, 
            project_root_for_ignores, 
            current_ignore_rules,
            current_custom_ignore_patterns
        )
        new_observer.schedule(event_handler, str(resolved_dir_to_watch), recursive=options.recursive)
        
        try:
            new_observer.start()
            observer_ref = new_observer
            observer_ref.__watching_directory = resolved_dir_to_watch # Store watched dir on instance
            # print(f"[FSWatcher] Started watching directory: {resolved_dir_to_watch} (Project root for ignores: {project_root_for_ignores})")
        except Exception as e:
            print(f"[FSWatcher] Error starting watch on {resolved_dir_to_watch}: {e}")
            observer_ref = None # Ensure it's cleared on failure

    def stop_watching():
        nonlocal observer_ref
        if observer_ref and observer_ref.is_alive():
            observer_ref.stop()
            observer_ref.join(timeout=2) # Wait for observer thread to finish
            # print(f"[FSWatcher] Stopped watching directory: {getattr(observer_ref, '__watching_directory', 'unknown')}")
        observer_ref = None

    def stop_all_and_clear_listeners():
        stop_watching()
        listeners_ref.clear()
        # print("[FSWatcher] All listeners cleared.")

    return {
        "register_listener": register_listener,
        "unregister_listener": unregister_listener,
        "start_watching": start_watching,
        "stop_watching": stop_watching,
        "stop_all_and_clear_listeners": stop_all_and_clear_listeners,
        "get_listeners": lambda: list(listeners_ref)
    }


# --- File Sync Logic ---
def compute_checksum(content: str) -> str:
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def is_valid_checksum(checksum: Optional[str]) -> bool:
    return isinstance(checksum, str) and len(checksum) == 64 and all(c in '0123456789abcdef' for c in checksum)

def load_ignore_rules_sync(project_root_str: str) -> ignore.Ignore:
    project_root = Path(project_root_str)
    ig = ignore.Ignore(DEFAULT_FILE_EXCLUSIONS, str(project_root)) # Pass base_dir to ignore
    
    gitignore_path = project_root / '.gitignore'
    if gitignore_path.exists():
        try:
            with open(gitignore_path, 'r', encoding='utf-8') as f:
                ig.add_patterns(f.read().splitlines())
        except Exception as e:
            print(f"[FileSync] Error reading .gitignore at {gitignore_path}: {e}. Using default exclusions.")
    return ig

async def load_ignore_rules(project_root_str: str) -> ignore.Ignore:
    return load_ignore_rules_sync(project_root_str)


def get_text_files(
    dir_path_str: str, 
    project_root_str: str, 
    ig: ignore.Ignore, 
    allowed_configs: List[str] = ALLOWED_FILE_CONFIGS
) -> List[str]: # Returns list of absolute paths
    
    files_found: List[str] = []
    start_dir = Path(dir_path_str)
    project_root = Path(project_root_str)

    # Use os.walk for better control over skipping CRITICAL_EXCLUDED_DIRS directly
    for root, dirs, files in os.walk(start_dir, topdown=True):
        # Filter out critical excluded directories from further traversal
        dirs[:] = [d for d in dirs if d not in CRITICAL_EXCLUDED_DIRS and not ig.ignores(normalize_path_for_db(Path(root).joinpath(d).relative_to(project_root)))]

        current_dir_path = Path(root)
        relative_dir_to_project = normalize_path_for_db(current_dir_path.relative_to(project_root))
        if ig.ignores(relative_dir_to_project) and relative_dir_to_project != '.': # Don't ignore project root itself with '.'
            dirs[:] = [] # Don't traverse into this directory further
            continue

        for filename in files:
            file_path_obj = current_dir_path / filename
            relative_file_to_project = normalize_path_for_db(file_path_obj.relative_to(project_root))

            if filename in CRITICAL_EXCLUDED_DIRS or ig.ignores(relative_file_to_project):
                continue
            
            file_ext = file_path_obj.suffix.lower()
            if filename in allowed_configs or file_ext in allowed_configs:
                try:
                    if file_path_obj.stat().st_size < 10 * 1024 * 1024: # Max 10MB
                        files_found.append(str(file_path_obj.resolve()))
                except FileNotFoundError:
                    pass 
                except Exception as e:
                    print(f"[FileSync] Error stating file {file_path_obj}: {e}")
    return files_found


async def sync_file_set(
    project: Project,
    absolute_project_path: Path,
    absolute_file_paths_on_disk: List[str],
    ig: ignore.Ignore
) -> Dict[str, int]:
    
    files_to_create_data: List[FileSyncData] = []
    files_to_update_data: List[Dict[str, Any]] = [] # {fileId: str, data: FileSyncData}
    file_ids_to_delete: List[str] = []
    skipped_count = 0

    existing_db_files_list = await get_project_files(project.id)
    if existing_db_files_list is None:
        raise ConnectionError(f"Could not retrieve existing files for project {project.id}")

    db_file_map = {normalize_path_for_db(f.path): f for f in existing_db_files_list}

    for abs_file_path_str in absolute_file_paths_on_disk:
        abs_file_path = Path(abs_file_path_str)
        relative_path = normalize_path_for_db(abs_file_path.relative_to(absolute_project_path))

        try:
            with open(abs_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            stats = abs_file_path.stat()
            checksum = compute_checksum(content)
            file_name = abs_file_path.name
            extension = abs_file_path.suffix.lower() if abs_file_path.suffix else (file_name if file_name.startswith('.') else None)
                 
            file_data = FileSyncData(
                path=relative_path,
                name=file_name,
                extension=extension,
                content=content,
                size=stats.st_size,
                checksum=checksum
            )

            existing_db_file = db_file_map.get(relative_path)

            if existing_db_file:
                if not is_valid_checksum(existing_db_file.checksum) or existing_db_file.checksum != checksum:
                    files_to_update_data.append({"fileId": existing_db_file.id, "data": file_data})
                else:
                    skipped_count += 1
                db_file_map.pop(relative_path, None) # Processed
            else:
                files_to_create_data.append(file_data)
        except Exception as file_error:
            print(f"[FileSync] Error processing file {abs_file_path} (relative: {relative_path}): {file_error}. Skipping.")
            db_file_map.pop(relative_path, None)
    
    for normalized_db_path, db_file in db_file_map.items():
        # If file is in DB but not on disk (or became ignored by getTextFiles already), delete.
        # We also check if it became ignored by current rules explicitly for files that might have been missed by getTextFiles' initial filter pass
        # (e.g. if ignore rules changed dramatically and getTextFiles still picked it up before but ig.ignores now catches it).
        if ig.ignores(normalized_db_path):
            file_ids_to_delete.append(db_file.id)
        else: # Not on disk and not explicitly ignored by *current* rules (implies it was deleted or is outside scope of files_on_disk)
            file_ids_to_delete.append(db_file.id)

    created_count, updated_count, deleted_count = 0, 0, 0
    try:
        if files_to_create_data:
            created_result = await bulk_create_project_files(project.id, files_to_create_data)
            created_count = len(created_result)
        if files_to_update_data:
            updated_result = await bulk_update_project_files(project.id, files_to_update_data)
            updated_count = len(updated_result)
        if file_ids_to_delete:
            delete_result = await bulk_delete_project_files(project.id, file_ids_to_delete)
            deleted_count = delete_result.get("deletedCount", 0)
        
        return {"created": created_count, "updated": updated_count, "deleted": deleted_count, "skipped": skipped_count}
    except Exception as e:
        print(f"[FileSync] Error during DB batch operations for project {project.id}: {e}")
        raise ConnectionError(f"SyncFileSet failed during storage ops for {project.id}")

async def sync_project(project: Project) -> Dict[str, int]:
    try:
        abs_project_path = resolve_path_py(project.path)
        if not abs_project_path.is_dir():
            raise ValueError(f"Project path is not a valid directory: {project.path}")

        ig_rules = await load_ignore_rules(str(abs_project_path))
        
        project_files_on_disk = get_text_files(
            str(abs_project_path),
            str(abs_project_path),
            ig_rules,
            ALLOWED_FILE_CONFIGS
        )
        return await sync_file_set(project, abs_project_path, project_files_on_disk, ig_rules)
    except Exception as e:
        print(f"[FileSync] Failed to sync project {project.id} ({project.name}): {e}")
        raise

async def sync_project_folder(project: Project, folder_path_relative: str) -> Dict[str, int]:
    try:
        abs_project_path = resolve_path_py(project.path)
        abs_folder_to_sync = (abs_project_path / folder_path_relative).resolve()

        if not abs_folder_to_sync.is_dir():
            raise ValueError(f"Folder path is not valid: {folder_path_relative}")
        
        ig_rules = await load_ignore_rules(str(abs_project_path)) # Project-level ignore
        
        # Pass absolute_folder_to_sync as starting dir, but project_root for ignore context
        folder_files_on_disk = get_text_files(
            str(abs_folder_to_sync),
            str(abs_project_path), 
            ig_rules,
            ALLOWED_FILE_CONFIGS
        )
        return await sync_file_set(project, abs_project_path, folder_files_on_disk, ig_rules)
    except Exception as e:
        print(f"[FileSync] Failed to sync folder '{folder_path_relative}' for project {project.id}: {e}")
        raise

# --- File Change Plugin Logic ---
def create_file_change_plugin():
    internal_watcher_ctrl = create_file_change_watcher()
    current_project_ref: Optional[Project] = None
    plugin_loop: Optional[asyncio.AbstractEventLoop] = None

    async def _ensure_plugin_loop():
        nonlocal plugin_loop
        if plugin_loop is None or plugin_loop.is_closed():
            try:
                plugin_loop = asyncio.get_event_loop()
            except RuntimeError: # No current event loop
                plugin_loop = asyncio.new_event_loop()
                # For a dedicated thread, you might need to set this loop for that thread.
                # asyncio.set_event_loop(plugin_loop) # This is complex with threads.
                # Better: run the loop in a dedicated thread if this plugin manages its own async tasks.
                # For now, assume get_event_loop() works or can be made to work.

    async def handle_file_change_async_impl(event: FileChangeEvent, changed_file_path_str: str):
        if not current_project_ref:
            # print("[FileChangePlugin] Project not set for handling change.")
            return
        
        # print(f"[FileChangePlugin] Async: Detected {event.value} for {changed_file_path_str} in project {current_project_ref.id}")
        try:
            # Re-sync first to update DB state
            await sync_project(current_project_ref) 
            
            all_files_in_db = await get_project_files(current_project_ref.id)
            if not all_files_in_db: return

            abs_project_path = resolve_path_py(current_project_ref.path)
            try:
                relative_changed_path = normalize_path_for_db(Path(changed_file_path_str).relative_to(abs_project_path))
            except ValueError: # Path is not within the project (e.g., temp file that got deleted)
                # print(f"[FileChangePlugin] Changed path {changed_file_path_str} not relative to project {abs_project_path}. Ignoring for summarization.")
                return
            
            updated_file_in_db = next((f for f in all_files_in_db if normalize_path_for_db(f.path) == relative_changed_path), None)

            if event == FileChangeEvent.DELETED or not updated_file_in_db:
                # print(f"[FileChangePlugin] File {relative_changed_path} deleted or not found after sync. No summarization.")
                return
            
            # print(f"[FileChangePlugin] Summarizing {updated_file_in_db.path}")
            await summarize_single_file(updated_file_in_db)
            # print(f"[FileChangePlugin] Finished processing {event.value} for {changed_file_path_str}")
        except Exception as e:
            print(f"[FileChangePlugin] Error handling file change for {changed_file_path_str}: {e}")

    def schedule_async_file_handling(event: FileChangeEvent, path_str: str):
        # This function is called from watchdog's thread.
        # It needs to schedule the async task on an appropriate asyncio loop.
        active_loop = plugin_loop # Use the loop associated with this plugin instance
        if active_loop and active_loop.is_running():
            asyncio.run_coroutine_threadsafe(handle_file_change_async_impl(event, path_str), active_loop)
        else:
            # Fallback if loop isn't running or not set. This could be problematic.
            # print(f"[FileChangePlugin-WARN] Event loop for plugin not available or not running. Attempting asyncio.run for {path_str}")
            try:
                 asyncio.run(handle_file_change_async_impl(event, path_str)) # Creates new loop, runs, closes
            except RuntimeError as re:
                 print(f"[FileChangePlugin-ERROR] RuntimeError with asyncio.run for {path_str}: {re}. Event might be lost.")

    async def start_plugin(project: Project, ignore_patterns: List[str] = []):
        nonlocal current_project_ref
        await _ensure_plugin_loop() # Ensure loop is available for scheduling tasks
        current_project_ref = project
        internal_watcher_ctrl["register_listener"](schedule_async_file_handling)
        
        project_abs_path_str = str(resolve_path_py(project.path))
        internal_watcher_ctrl["start_watching"](
            WatchOptions(directory=project_abs_path_str, ignore_patterns=ignore_patterns, recursive=True),
            project_abs_path_str # Project root for .gitignore evaluation
        )

    def stop_plugin():
        nonlocal current_project_ref
        internal_watcher_ctrl["stop_all_and_clear_listeners"]()
        current_project_ref = None
        # Note: plugin_loop is not closed here as it might be shared or managed externally.
        # If this plugin owned the loop exclusively (e.g. started it in its own thread), it should close it.

    return {
        "start": start_plugin,
        "stop": stop_plugin
    }


# --- Watchers Manager Logic ---
def create_watchers_manager():
    active_plugins_map: Dict[str, Dict[str, Any]] = {} # project_id -> plugin_dict
    manager_loop: Optional[asyncio.AbstractEventLoop] = None # Loop for manager's async operations

    async def _ensure_manager_loop():
        nonlocal manager_loop
        if manager_loop is None or manager_loop.is_closed():
            try: manager_loop = asyncio.get_running_loop()
            except RuntimeError: manager_loop = asyncio.new_event_loop()
            # Important: If new_event_loop is used, this manager might need to run its own thread with this loop.
            # asyncio.set_event_loop(manager_loop) # If this thread becomes the owner of the loop

    async def start_watching_project(project: Project, ignore_patterns: List[str] = []):
        await _ensure_manager_loop()
        if project.id in active_plugins_map:
            # print(f"[WatchersManager] Already watching project: {project.id}")
            return

        resolved_project_path = resolve_path_py(project.path)
        if not resolved_project_path.is_dir():
            print(f"[WatchersManager] Project path for {project.id} doesn't exist or not a dir: {resolved_project_path}")
            return

        plugin = create_file_change_plugin()
        try:
            # The plugin's start method is async and will internally manage its loop needs for callbacks.
            await plugin["start"](project, ignore_patterns)
            active_plugins_map[project.id] = plugin
            # print(f"[WatchersManager] Successfully started watching project: {project.id}")
        except Exception as e:
            print(f"[WatchersManager] Error starting plugin for project {project.id}: {e}")
            plugin["stop"]() # Ensure cleanup if start fails

    def stop_watching_project(project_id: str):
        plugin = active_plugins_map.pop(project_id, None)
        if plugin:
            plugin["stop"]()
            # print(f"[WatchersManager] Successfully stopped watching project: {project_id}")
        # else:
            # print(f"[WatchersManager] Not currently watching project: {project_id}. Cannot stop.")

    def stop_all_watchers():
        # print(f"[WatchersManager] Stopping all {len(active_plugins_map)} project watchers...")
        for project_id, plugin in list(active_plugins_map.items()): # Iterate over a copy for safe deletion
            plugin["stop"]()
            active_plugins_map.pop(project_id, None)
        # print("[WatchersManager] All project watchers have been stopped.")

    return {
        "start_watching_project": start_watching_project,
        "stop_watching_project": stop_watching_project,
        "stop_all_watchers": stop_all_watchers
    }

            