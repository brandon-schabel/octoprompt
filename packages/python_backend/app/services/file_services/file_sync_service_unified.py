# packages/python_backend/app/services/file_services/file_sync_service_unified.py
# - Changed stop_watching_project project_id to int.
# - Ensured active_plugins_map key type consistency (implicitly int via project.id).
# - No changes needed based on previous 3.
# -
# -
import asyncio
import hashlib
import os
import time
from enum import Enum
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any, Tuple, Set, Union, Literal
import threading

from pydantic import BaseModel, Field
import pathspec # Replaced 'ignore' with 'pathspec'
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent, \
    FileModifiedEvent, FileCreatedEvent, FileDeletedEvent, DirModifiedEvent, DirCreatedEvent, DirDeletedEvent

# --- Type Definitions (Mirrored from TS) ---

from app.schemas.project_schemas import Project, ProjectFile, FileSyncData # Ensure these are the correct schema imports
from app.services.project_service import (
    get_project_files,
    bulk_create_project_files,
    bulk_update_project_files,
    bulk_delete_project_files,
    list_projects, # If needed by file_sync_service
    summarize_single_file # If file_sync_service's watcher logic should call the real one
)
from app.services.project_service import Project as ProjectSchema # Alias if needed to avoid name clash



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
            print(f"[FSWatcher-CustomIgnore] Path '{relative_file_path}' matched custom pattern '{pattern_str}'")
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
        print(f"[FSWatcher-Handler] Initialized for base_path: {base_path}, project_root: {project_root}")

    def _dispatch_event(self, event_type: FileChangeEvent, path_str: str):
        # This method is called by watchdog, runs in watchdog's thread.
        # Listeners are now responsible for their own threading/async scheduling.
        print(f"[FSWatcher-Dispatch] Dispatching event: {event_type.value} for path: {path_str}")
        for listener in self.listeners:
            try:
                listener(event_type, path_str) # Listener is now `schedule_debounced_file_handling`
            except Exception as e:
                print(f"[FSWatcher-ERROR] Error in listener dispatch for {path_str}: {e}")

    def _process_event(self, event_type: FileChangeEvent, path_str: str):
        full_path = Path(path_str)
        # print(f"[FSWatcher-Process] Processing event: {event_type.value} for path: {full_path}")
        try:
            relative_path_to_project_root = normalize_path_for_db(full_path.relative_to(self.project_root))

            if any(part in CRITICAL_EXCLUDED_DIRS for part in Path(relative_path_to_project_root).parts):
                # print(f"[FSWatcher-Ignore] Critically excluded: {relative_path_to_project_root}")
                return
            if is_path_ignored_by_custom_patterns(relative_path_to_project_root, self.custom_ignore_patterns):
                # print(f"[FSWatcher-Ignore] Custom ignored: {relative_path_to_project_root}")
                return
            if self.spec and self.spec.match_file(relative_path_to_project_root):
                # print(f"[FSWatcher-Ignore] Pathspec (.gitignore) ignored: {relative_path_to_project_root}")
                return

            # print(f"[FSWatcher-Process] Event for {relative_path_to_project_root} not ignored. Dispatching.")
            self._dispatch_event(event_type, str(full_path))
        except ValueError:
            # print(f"[FSWatcher-WARN] Path {full_path} not relative to project root {self.project_root}.")
            pass
        except Exception as e:
            print(f"[FSWatcher-ERROR] Error processing event {event_type} for {path_str}: {e}")

    def on_any_event(self, event: FileSystemEvent):
        # Consolidate event handling
        if event.is_directory:
            # print(f"[FSWatcher-Event] Directory event: {event.event_type} for {event.src_path}")
            # Potentially handle directory creation/deletion if needed for full folder sync later
            # For now, primary focus is on file changes triggering summarization.
            # If a directory is deleted, its files will trigger delete events.
            # If a directory is created, files added to it will trigger create events.
            # If a directory is renamed, it's a move; src_path (deleted), dest_path (created)
            return

        # Check common critical exclusions first
        src_path_obj = Path(event.src_path)
        if src_path_obj.name in CRITICAL_EXCLUDED_DIRS:
            # print(f"[FSWatcher-Ignore] Critically excluded name: {src_path_obj.name}")
            return

        if event.event_type == 'created':
            self._process_event(FileChangeEvent.CREATED, event.src_path)
        elif event.event_type == 'modified':
            self._process_event(FileChangeEvent.MODIFIED, event.src_path)
        elif event.event_type == 'deleted':
            self._process_event(FileChangeEvent.DELETED, event.src_path)
        elif event.event_type == 'moved':
            dest_path_obj = Path(event.dest_path)
            if dest_path_obj.name in CRITICAL_EXCLUDED_DIRS:
                # print(f"[FSWatcher-Ignore] Critically excluded dest name in move: {dest_path_obj.name}")
                return
            # print(f"[FSWatcher-Event] on_moved: from {event.src_path} to {event.dest_path}")
            self._process_event(FileChangeEvent.DELETED, event.src_path)
            # Only process creation of destination if it's not a directory (or handle dir moves separately if needed)
            if not dest_path_obj.is_dir(): # Assuming we care about files moved
                 self._process_event(FileChangeEvent.CREATED, event.dest_path)


# --- File Watcher Creation (create_file_change_watcher) ---
# ... (Largely as is, but _UnifiedFileSystemEventHandler is simplified) ...

# --- File Sync Logic (compute_checksum, is_valid_checksum, etc.) ---
# ... (Your existing logic, ensure `load_ignore_rules_sync` is efficient or cached later) ...
# ... (Your existing `get_text_files`, `sync_file_set`, `sync_project`, `sync_project_folder`) ...


# --- File Change Plugin Logic (Focus of Debouncing and Loop Management) ---
def create_file_change_plugin():
    internal_watcher_ctrl = create_file_change_watcher()
    current_project_ref: Optional[ProjectSchema] = None # Use aliased ProjectSchema if that's the Pydantic model

    # --- Async Loop and Thread Management for this Plugin Instance ---
    plugin_loop: Optional[asyncio.AbstractEventLoop] = None
    plugin_thread: Optional[threading.Thread] = None
    # Use a dictionary to store last event time or timer handles for debouncing PER FILE
    # Simpler: one timer for the whole project, resetting on any new relevant event.
    _debounce_timer: Optional[asyncio.TimerHandle] = None
    _pending_changes: Set[Tuple[FileChangeEvent, str]] = set() # Collect changes during debounce window

    print("[FileChangePlugin-Create] File change plugin instance created.")

    def _run_plugin_event_loop():
        nonlocal plugin_loop
        if plugin_loop:
            print(f"[FileChangePlugin-Loop] Starting event loop in thread {threading.current_thread().name}")
            asyncio.set_event_loop(plugin_loop)
            try:
                plugin_loop.run_forever()
            finally:
                plugin_loop.close()
                print(f"[FileChangePlugin-Loop] Event loop closed in thread {threading.current_thread().name}")

    def _ensure_plugin_loop_is_running():
        nonlocal plugin_loop, plugin_thread
        if plugin_loop is None or plugin_loop.is_closed():
            plugin_loop = asyncio.new_event_loop()
            plugin_thread = threading.Thread(target=_run_plugin_event_loop, daemon=True, name=f"PluginLoop-{current_project_ref.id if current_project_ref else 'Unknown'}")
            plugin_thread.start()
            # It's good practice to wait briefly or use an Event to ensure the loop is running before scheduling tasks.
            # For simplicity here, we assume it starts quickly.
            print(f"[FileChangePlugin-Loop] Initialized and started event loop in thread: {plugin_thread.name}")
        elif not plugin_loop.is_running() and plugin_thread and not plugin_thread.is_alive():
            # This case means the loop was created, but the thread died or loop stopped. Recreate.
            print(f"[FileChangePlugin-Loop-WARN] Plugin thread for {current_project_ref.id if current_project_ref else 'Unknown'} found dead. Restarting.")
            plugin_loop.close() # Close old one first
            plugin_loop = asyncio.new_event_loop()
            plugin_thread = threading.Thread(target=_run_plugin_event_loop, daemon=True, name=f"PluginLoop-{current_project_ref.id if current_project_ref else 'Unknown'}")
            plugin_thread.start()
            print(f"[FileChangePlugin-Loop] Re-initialized and started event loop in thread: {plugin_thread.name}")


    async def _process_debounced_changes():
        nonlocal _pending_changes
        if not current_project_ref:
            print("[FileChangePlugin-DebouncedProc] Project not set. Clearing pending changes.")
            _pending_changes.clear()
            return

        if not _pending_changes:
            # print("[FileChangePlugin-DebouncedProc] No pending changes to process.")
            return

        changes_to_process = list(_pending_changes)
        _pending_changes.clear()
        project_id = current_project_ref.id

        print(f"[FileChangePlugin-DebouncedProc] Processing {len(changes_to_process)} changes for project {project_id}")

        # --- OPTIMIZATION 2: Granular Updates (Illustrative) ---
        # Instead of full sync_project, handle individual changes.
        # This requires more intricate logic and potentially new service functions
        # like `create_single_file`, `update_single_file`, `delete_single_file_by_path`.

        # For simplicity in this example, we'll still call sync_project,
        # but ideally, you'd iterate through `changes_to_process`
        # and apply granular updates.
        #
        # Example of granular approach (conceptual):
        # for event_type, path_str in changes_to_process:
        #     try:
        #         abs_project_path = resolve_path_py(current_project_ref.path)
        #         relative_path = normalize_path_for_db(Path(path_str).relative_to(abs_project_path))
        #         if event_type == FileChangeEvent.DELETED:
        #             print(f"[FileChangePlugin-Granular] Deleting {relative_path} for project {project_id}")
        #             # await delete_project_file_by_path(project_id, relative_path)
        #         else: # CREATED or MODIFIED
        #             # For CREATED/MODIFIED, you need the file content
        #             file_path_obj = Path(path_str)
        #             if not file_path_obj.exists() or not file_path_obj.is_file():
        #                 print(f"[FileChangePlugin-Granular] File {path_str} no longer exists. Skipping.")
        #                 # Potentially mark as deleted if it was a create/modify event
        #                 # await delete_project_file_by_path(project_id, relative_path, missing_ok=True)
        #                 continue
        #
        #             with open(file_path_obj, 'r', encoding='utf-8', errors='ignore') as f:
        #                 content = f.read()
        #             checksum = compute_checksum(content)
        #             file_data = FileSyncData(
        #                 path=relative_path,
        #                 name=file_path_obj.name,
        #                 extension=file_path_obj.suffix.lower() or None,
        #                 content=content, # For summarization, not necessarily for DB if just checksum needed
        #                 size=file_path_obj.stat().st_size,
        #                 checksum=checksum
        #             )
        #
        #             existing_file = await get_project_file_by_path(project_id, relative_path) # Needs this function
        #
        #             if event_type == FileChangeEvent.CREATED and not existing_file:
        #                 print(f"[FileChangePlugin-Granular] Creating {relative_path}")
        #                 # new_db_file = await create_project_file(project_id, file_data)
        #                 # await summarize_single_file(new_db_file)
        #             elif event_type == FileChangeEvent.MODIFIED or (event_type == FileChangeEvent.CREATED and existing_file):
        #                 if existing_file and existing_file.checksum != checksum:
        #                     print(f"[FileChangePlugin-Granular] Updating {relative_path}")
        #                     # updated_db_file = await update_project_file_content_and_checksum(existing_file.id, file_data)
        #                     # await summarize_single_file(updated_db_file)
        #                 elif not existing_file: # File was created, but appeared as modified by watcher perhaps
        #                      print(f"[FileChangePlugin-Granular] Creating {relative_path} (from modified event)")
        #                      # new_db_file = await create_project_file(project_id, file_data)
        #                      # await summarize_single_file(new_db_file)
        #
        #     except Exception as e:
        #         print(f"[FileChangePlugin-GranularError] Error processing {event_type} for {path_str}: {e}")

        # Fallback to full sync for now (or if granular fails)
        print(f"[FileChangePlugin-DebouncedProc] Triggering full sync_project for project {project_id} after {len(changes_to_process)} changes.")
        try:
            sync_result = await sync_project(current_project_ref) # current_project_ref is ProjectSchema
            print(f"[FileChangePlugin-DebouncedProc] Sync completed for project {project_id}. Result: {sync_result}")
            # After a full sync, all files are up-to-date.
            # If any of the `changes_to_process` were modifications or creations,
            # we might want to re-summarize them specifically IF sync_project doesn't do it.
            # However, `sync_project` updates files, and `summarize_single_file` is called by the *old* handler.
            # The original `handle_file_change_async_impl` called summarize AFTER sync.
            # Let's replicate that for the files that were *actually* changed and still exist.
            all_files_in_db = await get_project_files(project_id)
            if all_files_in_db:
                abs_project_path = resolve_path_py(current_project_ref.path)
                for event_type, path_str in changes_to_process:
                    if event_type == FileChangeEvent.DELETED:
                        continue
                    try:
                        relative_changed_path = normalize_path_for_db(Path(path_str).relative_to(abs_project_path))
                        updated_file_in_db = next((f for f in all_files_in_db if normalize_path_for_db(f.path) == relative_changed_path), None)
                        if updated_file_in_db:
                            print(f"[FileChangePlugin-DebouncedProc] Summarizing changed file: {updated_file_in_db.path}")
                            await summarize_single_file(updated_file_in_db) # summarize_single_file needs ProjectFile from DB
                    except ValueError: # Path not relative (e.g. temp file)
                        print(f"[FileChangePlugin-DebouncedProc-WARN] Changed path {path_str} not relative to project. Skipping summarization for it.")
                    except Exception as e:
                        print(f"[FileChangePlugin-DebouncedProc-ERROR] Error summarizing {path_str} after sync: {e}")

        except Exception as e:
            print(f"[FileChangePlugin-DebouncedProc-ERROR] Error during debounced sync_project for {project_id}: {e}")


    def schedule_debounced_file_handling(event: FileChangeEvent, path_str: str):
        nonlocal _debounce_timer, _pending_changes
        if not plugin_loop or not plugin_loop.is_running():
            print(f"[FileChangePlugin-Schedule-ERROR] Plugin loop not running for project {current_project_ref.id if current_project_ref else 'Unknown'}. Cannot schedule task for {path_str}. Event might be lost.")
            # Attempt to restart it, but this is a recovery, not ideal path
            if current_project_ref: _ensure_plugin_loop_is_running()
            if not plugin_loop or not plugin_loop.is_running(): return # Still not running, give up

        # Add change to the pending set
        _pending_changes.add((event, path_str))
        # print(f"[FileChangePlugin-Schedule] Added to pending: {event.value} for {path_str}. Total pending: {len(_pending_changes)}")

        # Cancel existing timer
        if _debounce_timer:
            _debounce_timer.cancel()
            # print("[FileChangePlugin-Schedule] Canceled previous debounce timer.")

        # Schedule the consolidated processing task
        _debounce_timer = plugin_loop.call_later(
            DEBOUNCE_DELAY_SECONDS,
            lambda: asyncio.run_coroutine_threadsafe(_process_debounced_changes(), plugin_loop)
        )
        # print(f"[FileChangePlugin-Schedule] Scheduled debounced processing in {DEBOUNCE_DELAY_SECONDS}s.")


    async def start_plugin(project: ProjectSchema, ignore_patterns: List[str] = []):
        nonlocal current_project_ref
        current_project_ref = project # project is ProjectSchema
        print(f"[FileChangePlugin-Start] Attempting to start plugin for project: {project.id} ({project.name})")

        _ensure_plugin_loop_is_running() # Ensure loop is running in its thread

        internal_watcher_ctrl["register_listener"](schedule_debounced_file_handling) # This is the debounced scheduler
        
        project_abs_path_str = str(resolve_path_py(project.path))
        internal_watcher_ctrl["start_watching"](
            WatchOptions(directory=project_abs_path_str, ignore_patterns=ignore_patterns, recursive=True),
            project_abs_path_str
        )
        print(f"[FileChangePlugin-Start] Plugin started and watching for project: {project.id}")

    def stop_plugin():
        nonlocal current_project_ref, plugin_loop, plugin_thread, _debounce_timer, _pending_changes
        project_id_info = current_project_ref.id if current_project_ref else "N/A"
        print(f"[FileChangePlugin-Stop] Stopping plugin for project: {project_id_info}")

        internal_watcher_ctrl["stop_all_and_clear_listeners"]() # Stops watchdog and unregisters listener

        if _debounce_timer:
            _debounce_timer.cancel()
            _debounce_timer = None
        _pending_changes.clear()

        if plugin_loop and not plugin_loop.is_closed():
            # Schedule one last task to process any remaining changes before stopping the loop
            # Or decide to discard them if stopping abruptly.
            # For a clean shutdown, you might want to process pending changes if feasible.
            # Then, stop the loop.
            if plugin_loop.is_running():
                 plugin_loop.call_soon_threadsafe(plugin_loop.stop)
            else: # If loop somehow stopped but not closed
                 try: plugin_loop.close()
                 except Exception as e : print(f"Error closing non-running loop: {e}")
        
        if plugin_thread and plugin_thread.is_alive():
            plugin_thread.join(timeout=5) # Wait for thread to finish
            if plugin_thread.is_alive():
                print(f"[FileChangePlugin-Stop-WARN] Plugin event loop thread for {project_id_info} did not stop in time.")
        
        plugin_loop = None
        plugin_thread = None
        current_project_ref = None
        print(f"[FileChangePlugin-Stop] Plugin stopped for project: {project_id_info}")

    return {
        "start": start_plugin,
        "stop": stop_plugin
    }


# --- Watchers Manager Logic ---
def create_watchers_manager():
    active_plugins_map: Dict[int, Dict[str, Any]] = {} # project_id (int) -> plugin_dict
    # Manager doesn't need its own loop if plugins manage theirs for event handling.
    # It only orchestrates plugin creation/stopping, which can be async if plugin start/stop is.
    print("[WatchersManager-Create] Watchers manager created.")

    # No _ensure_manager_loop needed if manager's methods are primarily orchestrating
    # plugin start/stop and those plugins manage their own threaded loops.

    async def start_watching_project(project: ProjectSchema, ignore_patterns: List[str] = []):
        # project is ProjectSchema, project.id is int
        print(f"[WatchersManager-StartProject] Request to watch project: {project.id} ({project.name})")
        if project.id in active_plugins_map:
            print(f"[WatchersManager-StartProject] Already watching project: {project.id}.")
            return

        resolved_project_path = resolve_path_py(project.path)
        if not resolved_project_path.is_dir():
            print(f"[WatchersManager-ERROR] Project path {resolved_project_path} invalid. Cannot watch.")
            return

        plugin = create_file_change_plugin() # This sets up the plugin, including its thread and loop mechanism
        try:
            # plugin["start"] is now async, so await it.
            await plugin["start"](project, ignore_patterns) # project is ProjectSchema
            active_plugins_map[project.id] = plugin # project.id is int
            print(f"[WatchersManager-StartProject] Successfully watching project: {project.id}")
        except Exception as e:
            print(f"[WatchersManager-ERROR] Error starting plugin for project {project.id}: {e}")
            plugin["stop"]() # Ensure cleanup

    def stop_watching_project(project_id: int): # project_id is int
        print(f"[WatchersManager-StopProject] Request to stop watching project: {project_id}")
        plugin = active_plugins_map.pop(project_id, None)
        if plugin:
            plugin["stop"]() # This will handle stopping the thread/loop
            print(f"[WatchersManager-StopProject] Successfully stopped watching project: {project_id}")
        else:
            print(f"[WatchersManager-StopProject] Not watching project: {project_id}.")

    def stop_all_watchers():
        print(f"[WatchersManager-StopAll] Stopping all {len(active_plugins_map)} watchers...")
        for project_id in list(active_plugins_map.keys()): # Iterate on copy of keys
            stop_watching_project(project_id) # project_id is int
        print("[WatchersManager-StopAll] All watchers stopped.")

    return {
        "start_watching_project": start_watching_project,
        "stop_watching_project": stop_watching_project,
        "stop_all_watchers": stop_all_watchers
    }


def create_file_change_watcher():
    observer_ref: Optional[Observer] = None
    listeners_ref: List[FileChangeListener] = []
    # project_root_for_watcher_ref etc. are part of the closure of start_watching
    print("[FSWatcher-Create] File change watcher created.")

    def register_listener(listener: FileChangeListener):
        if listener not in listeners_ref:
            listeners_ref.append(listener)
            print(f"[FSWatcher-Listener] Registered listener: {listener}")
        # else:
            # print(f"[FSWatcher-Listener] Listener already registered: {listener}")

    def unregister_listener(listener: FileChangeListener):
        if listener in listeners_ref:
            listeners_ref.remove(listener)
            print(f"[FSWatcher-Listener] Unregistered listener: {listener}")
        # else:
            # print(f"[FSWatcher-Listener] Listener not found for unregistration: {listener}")

    def start_watching(options: WatchOptions, project_reference_root_str: str):
        nonlocal observer_ref
        print(f"[FSWatcher-Start] Attempting to start watching directory: {options.directory}, project_root_for_ignores: {project_reference_root_str}")
        
        resolved_dir_to_watch = resolve_path_py(options.directory)
        project_root_for_ignores = resolve_path_py(project_reference_root_str)
        current_custom_ignore_patterns = options.ignore_patterns or []
        print(f"[FSWatcher-Start] Custom ignore patterns: {current_custom_ignore_patterns}")


        if observer_ref and observer_ref.is_alive() and hasattr(observer_ref, '__watching_directory') and observer_ref.__watching_directory == resolved_dir_to_watch:
            print(f"[FSWatcher-Start] Already watching: {resolved_dir_to_watch}")
            return
        if observer_ref and observer_ref.is_alive():
            print(f"[FSWatcher-Start] Stopping previous watcher before starting new.")
            stop_watching() # Stop previous before starting new

        if not resolved_dir_to_watch.is_dir():
            print(f"[FSWatcher-ERROR] Directory does not exist or is not a dir: {resolved_dir_to_watch}")
            return
        
        current_pathspec_rules = load_ignore_rules_sync(str(project_root_for_ignores))
        if current_pathspec_rules:
                print(f"[FSWatcher-Start] Loaded {len(current_pathspec_rules.patterns)} pathspec rules.")
        else:
                print(f"[FSWatcher-Start] No pathspec rules loaded (or error).")


        new_observer = Observer()
        event_handler = _UnifiedFileSystemEventHandler(
            resolved_dir_to_watch, 
            listeners_ref, 
            project_root_for_ignores, 
            current_pathspec_rules,
            current_custom_ignore_patterns
        )
        new_observer.schedule(event_handler, str(resolved_dir_to_watch), recursive=options.recursive)
        
        try:
            new_observer.start()
            observer_ref = new_observer
            observer_ref.__watching_directory = resolved_dir_to_watch # Store watched dir on instance
            print(f"[FSWatcher-Start] Successfully started watching directory: {resolved_dir_to_watch} (Project root for ignores: {project_root_for_ignores})")
        except Exception as e:
            print(f"[FSWatcher-ERROR] Error starting watch on {resolved_dir_to_watch}: {e}")
            observer_ref = None # Ensure it's cleared on failure

    def stop_watching():
        nonlocal observer_ref
        if observer_ref and observer_ref.is_alive():
            watched_dir = getattr(observer_ref, '__watching_directory', 'unknown')
            print(f"[FSWatcher-Stop] Stopping watch on directory: {watched_dir}")
            observer_ref.stop()
            observer_ref.join(timeout=2) # Wait for observer thread to finish
            print(f"[FSWatcher-Stop] Successfully stopped watching directory: {watched_dir}")
        # else:
            # print(f"[FSWatcher-Stop] No active watcher to stop.")
        observer_ref = None

    def stop_all_and_clear_listeners():
        print("[FSWatcher-Clear] Stopping all and clearing listeners.")
        stop_watching()
        listeners_ref.clear()
        print("[FSWatcher-Clear] All listeners cleared.")

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

def load_ignore_rules_sync(project_root_str: str) -> Optional[pathspec.PathSpec]:
    project_root = Path(project_root_str)
    print(f"[FileSync-Ignore] Loading ignore rules for project root: {project_root}")
    patterns = list(DEFAULT_FILE_EXCLUSIONS) # Start with defaults
    print(f"[FileSync-Ignore] Default exclusions count: {len(patterns)}")
    
    gitignore_path = project_root / '.gitignore'
    if gitignore_path.exists() and gitignore_path.is_file():
        try:
            with open(gitignore_path, 'r', encoding='utf-8') as f:
                gitignore_lines = f.read().splitlines()
                patterns.extend(gitignore_lines)
                print(f"[FileSync-Ignore] Read {len(gitignore_lines)} lines from {gitignore_path}")
        except Exception as e:
            print(f"[FileSync-ERROR] Error reading .gitignore at {gitignore_path}: {e}. Using default/existing exclusions only.")
    else:
        print(f"[FileSync-Ignore] No .gitignore file found at {gitignore_path}")
    
    if not patterns:
        print("[FileSync-Ignore] No patterns found (default or .gitignore). No pathspec created.")
        return None
    try:
        # Use 'gitwildmatch' for .gitignore style pattern matching
        spec = pathspec.PathSpec.from_lines('gitwildmatch', patterns)
        print(f"[FileSync-Ignore] Compiled {len(spec.patterns)} pathspec patterns successfully.")
        return spec
    except Exception as e:
        print(f"[FileSync-ERROR] Error compiling pathspec patterns for {project_root_str}: {e}")
        return None # Return None if compilation fails

async def load_ignore_rules(project_root_str: str) -> Optional[pathspec.PathSpec]:
    # This is technically synchronous now, but kept async signature for compatibility if needed
    return load_ignore_rules_sync(project_root_str)


def get_text_files(
    dir_path_str: str, 
    project_root_str: str, 
    spec: Optional[pathspec.PathSpec], # Changed from ig: ignore.Ignore
    allowed_configs: List[str] = ALLOWED_FILE_CONFIGS
) -> List[str]: # Returns list of absolute paths
    
    files_found: List[str] = []
    start_dir = Path(dir_path_str)
    project_root = Path(project_root_str)
    print(f"[FileSync-GetFiles] Scanning for text files in: {start_dir} (Project root: {project_root})")

    for root, dirs, files in os.walk(start_dir, topdown=True):
        current_dir_path = Path(root)
        # print(f"[FileSync-GetFiles] Walking: {current_dir_path}")
        
        # Filter out critical excluded directories from further traversal
        # And directories matched by pathspec
        dirs_to_remove = set()
        for d_name in dirs:
            dir_full_path = current_dir_path / d_name
            relative_dir_to_project = normalize_path_for_db(dir_full_path.relative_to(project_root))
            
            critically_excluded = d_name in CRITICAL_EXCLUDED_DIRS
            pathspec_ignored = spec and spec.match_file(relative_dir_to_project)

            if critically_excluded:
                # print(f"[FileSync-GetFiles-IgnoreDir] Critically excluding dir: {relative_dir_to_project}")
                dirs_to_remove.add(d_name)
            elif pathspec_ignored:
                # print(f"[FileSync-GetFiles-IgnoreDir] Pathspec ignoring dir: {relative_dir_to_project}")
                dirs_to_remove.add(d_name)
        
        if dirs_to_remove:
            dirs[:] = [d for d in dirs if d not in dirs_to_remove]

        # If the current directory itself is ignored (and not root), skip files in it
        if current_dir_path != project_root:
            relative_current_dir_to_project = normalize_path_for_db(current_dir_path.relative_to(project_root))
            if spec and spec.match_file(relative_current_dir_to_project):
                # print(f"[FileSync-GetFiles-IgnoreDir] Skipping files in ignored directory: {relative_current_dir_to_project}")
                continue # Don't process files in this directory

        for filename in files:
            file_path_obj = current_dir_path / filename
            relative_file_to_project = normalize_path_for_db(file_path_obj.relative_to(project_root))

            critically_excluded_file = filename in CRITICAL_EXCLUDED_DIRS
            pathspec_ignored_file = spec and spec.match_file(relative_file_to_project)

            if critically_excluded_file:
                # print(f"[FileSync-GetFiles-IgnoreFile] Critically excluding file: {relative_file_to_project}")
                continue
            if pathspec_ignored_file:
                # print(f"[FileSync-GetFiles-IgnoreFile] Pathspec ignoring file: {relative_file_to_project}")
                continue
            
            file_ext = file_path_obj.suffix.lower()
            # Check if filename itself or its extension is in allowed_configs
            is_allowed_name = filename in allowed_configs
            is_allowed_ext = file_ext in allowed_configs
            
            # Handle case for files like '.env' which have no extension but should be matched by name
            if not file_ext and file_path_obj.name.startswith('.') and file_path_obj.name in allowed_configs:
                is_allowed_name = True

            if is_allowed_name or is_allowed_ext:
                try:
                    # Basic check to avoid excessively large files, can be refined
                    if file_path_obj.is_file() and file_path_obj.stat().st_size < 10 * 1024 * 1024: # Max 10MB, ensure it's a file
                        files_found.append(str(file_path_obj.resolve()))
                        # print(f"[FileSync-GetFiles-Found] Added: {file_path_obj.resolve()}")
                    # elif not file_path_obj.is_file():
                        # print(f"[FileSync-GetFiles-Skip] Not a file: {file_path_obj}")
                    # else:
                        # print(f"[FileSync-GetFiles-Skip] File too large: {file_path_obj} size: {file_path_obj.stat().st_size}")
                except FileNotFoundError:
                    print(f"[FileSync-WARN] File not found during stat: {file_path_obj}")
                    pass 
                except Exception as e:
                    print(f"[FileSync-ERROR] Error stating file {file_path_obj}: {e}")
            # else:
                # print(f"[FileSync-GetFiles-Skip] Not allowed extension/name: {filename} (ext: {file_ext})")
    print(f"[FileSync-GetFiles] Found {len(files_found)} text files in {start_dir}")
    return files_found


async def sync_file_set(
    project: Project,
    absolute_project_path: Path,
    absolute_file_paths_on_disk: List[str],
    spec: Optional[pathspec.PathSpec] # Changed from ig: ignore.Ignore
) -> Dict[str, int]:
    print(f"[FileSync-SyncSet] Starting file set sync for project: {project.id} ({project.name}). Files on disk: {len(absolute_file_paths_on_disk)}")
    
    files_to_create_data: List[FileSyncData] = []
    files_to_update_data: List[Dict[str, Any]] = [] # {fileId: int, data: FileSyncData}
    file_ids_to_delete: List[int] = []
    skipped_count = 0

    # project.id is already int
    existing_db_files_list = await get_project_files(project.id)
    if existing_db_files_list is None:
        print(f"[FileSync-ERROR] Could not retrieve existing files for project {project.id}. Aborting sync_file_set.")
        raise ConnectionError(f"Could not retrieve existing files for project {project.id}")
    print(f"[FileSync-SyncSet] Found {len(existing_db_files_list)} files in DB for project {project.id}")

    db_file_map = {normalize_path_for_db(f.path): f for f in existing_db_files_list}

    for abs_file_path_str in absolute_file_paths_on_disk:
        abs_file_path = Path(abs_file_path_str)
        relative_path = normalize_path_for_db(abs_file_path.relative_to(absolute_project_path))
        # print(f"[FileSync-SyncSet] Processing disk file: {relative_path}")

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
                extension=extension, # Ensure ProjectFile schema has 'extension' matching this logic
                content=content,
                size=stats.st_size,
                checksum=checksum
            )

            existing_db_file = db_file_map.get(relative_path)

            if existing_db_file:
                if not is_valid_checksum(existing_db_file.checksum) or existing_db_file.checksum != checksum:
                    # print(f"[FileSync-SyncSet] File changed (checksum mismatch): {relative_path}. Marking for update.")
                    files_to_update_data.append({"fileId": existing_db_file.id, "data": file_data}) # existing_db_file.id is int
                else:
                    # print(f"[FileSync-SyncSet] File unchanged (checksum match): {relative_path}. Skipping.")
                    skipped_count += 1
                db_file_map.pop(relative_path, None) # Processed
            else:
                # print(f"[FileSync-SyncSet] New file: {relative_path}. Marking for creation.")
                files_to_create_data.append(file_data)
        except Exception as file_error:
            print(f"[FileSync-ERROR] Error processing file {abs_file_path} (relative: {relative_path}): {file_error}. Skipping.")
            db_file_map.pop(relative_path, None) # Remove from consideration if error
    
    # Any files remaining in db_file_map are on DB but not on disk (or were skipped due to error/ignore)
    for normalized_db_path, db_file in db_file_map.items():
        # print(f"[FileSync-SyncSet] File in DB but not on disk (or became ignored): {normalized_db_path}")
        # We also check if it became ignored by current rules explicitly for files that might have been missed by getTextFiles' initial filter pass
        # (e.g. if ignore rules changed dramatically and getTextFiles still picked it up before but ig.ignores now catches it).
        if spec and spec.match_file(normalized_db_path):
            print(f"[FileSync-SyncSet] DB file '{normalized_db_path}' is now ignored by pathspec. Marking for deletion.")
            file_ids_to_delete.append(db_file.id) # db_file.id is int
        else: # Not on disk and not explicitly ignored by *current* rules (implies it was deleted or is outside scope of files_on_disk)
            print(f"[FileSync-SyncSet] DB file '{normalized_db_path}' not found on disk and not pathspec-ignored. Marking for deletion (presumed deleted).")
            file_ids_to_delete.append(db_file.id) # db_file.id is int

    created_count, updated_count, deleted_count = 0, 0, 0
    print(f"[FileSync-SyncSet] DB operations: Create: {len(files_to_create_data)}, Update: {len(files_to_update_data)}, Delete: {len(file_ids_to_delete)}")
    try:
        if files_to_create_data:
            created_result = await bulk_create_project_files(project.id, files_to_create_data) # project.id is int
            created_count = len(created_result)
            print(f"[FileSync-SyncSet-DB] Created {created_count} files for project {project.id}")
        if files_to_update_data:
            updated_result = await bulk_update_project_files(project.id, files_to_update_data) # project.id is int
            updated_count = len(updated_result)
            print(f"[FileSync-SyncSet-DB] Updated {updated_count} files for project {project.id}")
        if file_ids_to_delete:
            delete_result = await bulk_delete_project_files(project.id, file_ids_to_delete) # project.id is int, file_ids_to_delete is List[int]
            deleted_count = delete_result.get("deleted_count", 0) # TS uses deletedCount
            print(f"[FileSync-SyncSet-DB] Deleted {deleted_count} files for project {project.id}")
        
        result_summary = {"created": created_count, "updated": updated_count, "deleted": deleted_count, "skipped": skipped_count}
        print(f"[FileSync-SyncSet] Completed for project {project.id}. Summary: {result_summary}")
        return result_summary
    except Exception as e:
        print(f"[FileSync-ERROR] Error during DB batch operations for project {project.id}: {e}")
        raise ConnectionError(f"SyncFileSet failed during storage ops for {project.id}")

async def sync_project(project: Project) -> Dict[str, int]:
    print(f"[FileSync-Project] Starting sync for project ID: {project.id}, Name: {project.name}, Path: {project.path}") # project.id is int
    try:
        abs_project_path = resolve_path_py(project.path)
        if not abs_project_path.is_dir():
            print(f"[FileSync-ERROR] Project path is not a valid directory: {project.path}")
            raise ValueError(f"Project path is not a valid directory: {project.path}")

        pathspec_rules = await load_ignore_rules(str(abs_project_path))
        
        project_files_on_disk = get_text_files(
            str(abs_project_path),
            str(abs_project_path),
            pathspec_rules, # use pathspec_rules
            ALLOWED_FILE_CONFIGS
        )
        return await sync_file_set(project, abs_project_path, project_files_on_disk, pathspec_rules) # use pathspec_rules
    except Exception as e:
        print(f"[FileSync-ERROR] Failed to sync project {project.id} ({project.name}): {e}")
        raise

async def sync_project_folder(project: Project, folder_path_relative: str) -> Dict[str, int]:
    print(f"[FileSync-Folder] Starting sync for folder '{folder_path_relative}' in project {project.id} ({project.name})") # project.id is int
    try:
        abs_project_path = resolve_path_py(project.path)
        abs_folder_to_sync = (abs_project_path / folder_path_relative).resolve()
        print(f"[FileSync-Folder] Absolute folder path to sync: {abs_folder_to_sync}")

        if not abs_folder_to_sync.is_dir():
            print(f"[FileSync-ERROR] Folder path is not valid: {folder_path_relative} (resolved: {abs_folder_to_sync})")
            raise ValueError(f"Folder path is not valid: {folder_path_relative}")
        
        pathspec_rules = await load_ignore_rules(str(abs_project_path)) # Project-level ignore
        
        # Pass absolute_folder_to_sync as starting dir, but project_root for ignore context
        folder_files_on_disk = get_text_files(
            str(abs_folder_to_sync),
            str(abs_project_path), 
            pathspec_rules, # use pathspec_rules
            ALLOWED_FILE_CONFIGS
        )
        return await sync_file_set(project, abs_project_path, folder_files_on_disk, pathspec_rules) # use pathspec_rules
    except Exception as e:
        print(f"[FileSync-ERROR] Failed to sync folder '{folder_path_relative}' for project {project.id}: {e}")
        raise

# --- File Change Plugin Logic ---
def create_file_change_plugin():
    internal_watcher_ctrl = create_file_change_watcher()
    current_project_ref: Optional[Project] = None
    plugin_loop: Optional[asyncio.AbstractEventLoop] = None
    print("[FileChangePlugin-Create] File change plugin instance created.")

    async def _ensure_plugin_loop():
        nonlocal plugin_loop
        if plugin_loop is None or plugin_loop.is_closed():
            print("[FileChangePlugin-Loop] Plugin loop not set or closed. Attempting to get/create one.")
            try:
                plugin_loop = asyncio.get_event_loop() # Try to get current thread's loop
                print(f"[FileChangePlugin-Loop] Obtained existing event loop: {plugin_loop}")
            except RuntimeError: # No current event loop
                print("[FileChangePlugin-Loop] No current event loop. Creating new one for plugin.")
                plugin_loop = asyncio.new_event_loop()
                # If this plugin runs in its own thread, this new loop needs to be set for that thread:
                # asyncio.set_event_loop(plugin_loop)
                # And then run: plugin_loop.run_forever()
                # For now, assuming run_coroutine_threadsafe can handle it or loop is managed externally.
                print(f"[FileChangePlugin-Loop] Created new event loop: {plugin_loop}")

    async def handle_file_change_async_impl(event: FileChangeEvent, changed_file_path_str: str):
        if not current_project_ref:
            print("[FileChangePlugin-Handle] Project not set for handling change. Skipping.")
            return
        
        # current_project_ref.id is int
        print(f"[FileChangePlugin-Handle] Async: Detected {event.value} for {changed_file_path_str} in project {current_project_ref.id} ({current_project_ref.name})")
        try:
            print(f"[FileChangePlugin-Handle] Re-syncing project {current_project_ref.id} before processing change...")
            # Re-sync first to update DB state
            sync_result = await sync_project(current_project_ref) 
            print(f"[FileChangePlugin-Handle] Sync completed for project {current_project_ref.id}. Result: {sync_result}")
            
            all_files_in_db = await get_project_files(current_project_ref.id) # current_project_ref.id is int
            if not all_files_in_db:
                print(f"[FileChangePlugin-Handle] No files found in DB for project {current_project_ref.id} after sync. Cannot proceed with summarization.")
                return

            abs_project_path = resolve_path_py(current_project_ref.path)
            try:
                relative_changed_path = normalize_path_for_db(Path(changed_file_path_str).relative_to(abs_project_path))
                print(f"[FileChangePlugin-Handle] Relative path of changed file: {relative_changed_path}")
            except ValueError: # Path is not within the project (e.g., temp file that got deleted)
                print(f"[FileChangePlugin-WARN] Changed path {changed_file_path_str} not relative to project {abs_project_path}. Ignoring for summarization.")
                return
            
            updated_file_in_db = next((f for f in all_files_in_db if normalize_path_for_db(f.path) == relative_changed_path), None)

            if event == FileChangeEvent.DELETED or not updated_file_in_db:
                print(f"[FileChangePlugin-Handle] File {relative_changed_path} was DELETED or not found in DB after sync. No summarization.")
                return
            
            # updated_file_in_db.id is int
            print(f"[FileChangePlugin-Handle] Summarizing file: {updated_file_in_db.path} (ID: {updated_file_in_db.id})")
            await summarize_single_file(updated_file_in_db) # summarize_single_file takes ProjectFile
            print(f"[FileChangePlugin-Handle] Finished processing and summarizing {event.value} for {changed_file_path_str} (Relative: {relative_changed_path})")
        except Exception as e:
            print(f"[FileChangePlugin-ERROR] Error handling file change for {changed_file_path_str} (Project: {current_project_ref.id}): {e}")

    def schedule_async_file_handling(event: FileChangeEvent, path_str: str):
        # This function is called from watchdog's thread.
        # It needs to schedule the async task on an appropriate asyncio loop.
        print(f"[FileChangePlugin-Schedule] Scheduling async handling for event: {event.value}, path: {path_str}")
        active_loop = plugin_loop # Use the loop associated with this plugin instance
        if active_loop and active_loop.is_running():
            print(f"[FileChangePlugin-Schedule] Plugin loop is active. Scheduling task {event.value} for {path_str} via run_coroutine_threadsafe.")
            asyncio.run_coroutine_threadsafe(handle_file_change_async_impl(event, path_str), active_loop)
        else:
            print(f"[FileChangePlugin-WARN] Event loop for plugin not available or not running. Attempting asyncio.run for {path_str}. This might block watchdog or fail if called from non-main thread without loop.")
            try:
                asyncio.run(handle_file_change_async_impl(event, path_str)) # Creates new loop, runs, closes. Potentially problematic.
            except RuntimeError as re:
                print(f"[FileChangePlugin-ERROR] RuntimeError with asyncio.run for {path_str}: {re}. Event might be lost.")

    async def start_plugin(project: Project, ignore_patterns: List[str] = []):
        nonlocal current_project_ref
        # project.id is int
        print(f"[FileChangePlugin-Start] Attempting to start plugin for project: {project.id} ({project.name}), Path: {project.path}")
        await _ensure_plugin_loop() # Ensure loop is available for scheduling tasks
        current_project_ref = project
        internal_watcher_ctrl["register_listener"](schedule_async_file_handling)
        
        project_abs_path_str = str(resolve_path_py(project.path))
        print(f"[FileChangePlugin-Start] Absolute project path for watcher: {project_abs_path_str}")
        print(f"[FileChangePlugin-Start] Custom ignore patterns for watcher: {ignore_patterns}")
        internal_watcher_ctrl["start_watching"](
            WatchOptions(directory=project_abs_path_str, ignore_patterns=ignore_patterns, recursive=True),
            project_abs_path_str # Project root for .gitignore evaluation
        )
        print(f"[FileChangePlugin-Start] Plugin started for project: {project.id}")

    def stop_plugin():
        nonlocal current_project_ref
        project_id_info: Union[int, str] = current_project_ref.id if current_project_ref else "N/A" # project.id is int
        print(f"[FileChangePlugin-Stop] Stopping plugin for project: {project_id_info}")
        internal_watcher_ctrl["stop_all_and_clear_listeners"]()
        current_project_ref = None
        # Note: plugin_loop is not closed here as it might be shared or managed externally.
        # If this plugin owned the loop exclusively (e.g. started it in its own thread), it should close it.
        print(f"[FileChangePlugin-Stop] Plugin stopped for project: {project_id_info}")

    return {
        "start": start_plugin,
        "stop": stop_plugin
    }


# --- Watchers Manager Logic ---
def create_watchers_manager():
    active_plugins_map: Dict[int, Dict[str, Any]] = {} # project_id (int) -> plugin_dict
    manager_loop: Optional[asyncio.AbstractEventLoop] = None # Loop for manager's async operations
    print("[WatchersManager-Create] Watchers manager created.")

    async def _ensure_manager_loop():
        nonlocal manager_loop
        if manager_loop is None or manager_loop.is_closed():
            print("[WatchersManager-Loop] Manager loop not set or closed. Attempting to get/create.")
            try: 
                manager_loop = asyncio.get_running_loop()
                print(f"[WatchersManager-Loop] Obtained existing running loop for manager: {manager_loop}")
            except RuntimeError: 
                print("[WatchersManager-Loop] No running loop for manager. Creating new one.")
                manager_loop = asyncio.new_event_loop()
                # If this manager runs in its own thread, this new loop needs to be set for that thread:
                # asyncio.set_event_loop(manager_loop)
                # And then run: manager_loop.run_forever()
                print(f"[WatchersManager-Loop] Created new event loop for manager: {manager_loop}")


    async def start_watching_project(project: Project, ignore_patterns: List[str] = []):
        await _ensure_manager_loop() # Ensure manager has a loop for its own async operations if any
        # project.id is int
        print(f"[WatchersManager-StartProject] Request to watch project: {project.id} ({project.name}), Path: {project.path}")
        if project.id in active_plugins_map: # project.id is int, map key is int
            print(f"[WatchersManager-StartProject] Already watching project: {project.id}. Ignoring request.")
            return

        resolved_project_path = resolve_path_py(project.path)
        if not resolved_project_path.is_dir():
            print(f"[WatchersManager-ERROR] Project path for {project.id} doesn't exist or not a dir: {resolved_project_path}. Cannot start watcher.")
            return

        print(f"[WatchersManager-StartProject] Creating new file change plugin for project: {project.id}")
        plugin = create_file_change_plugin()
        try:
            # The plugin's start method is async and will internally manage its loop needs for callbacks.
            print(f"[WatchersManager-StartProject] Starting plugin for project: {project.id} with ignore_patterns: {ignore_patterns}")
            await plugin["start"](project, ignore_patterns) # project has int id
            active_plugins_map[project.id] = plugin # project.id is int
            print(f"[WatchersManager-StartProject] Successfully started watching and plugin registered for project: {project.id}")
        except Exception as e:
            print(f"[WatchersManager-ERROR] Error starting plugin for project {project.id}: {e}")
            plugin["stop"]() # Ensure cleanup if start fails

    def stop_watching_project(project_id: int): # Changed project_id to int
        print(f"[WatchersManager-StopProject] Request to stop watching project: {project_id}")
        plugin = active_plugins_map.pop(project_id, None) # project_id is int
        if plugin:
            plugin["stop"]()
            print(f"[WatchersManager-StopProject] Successfully stopped watching project: {project_id}")
        else:
            print(f"[WatchersManager-StopProject] Not currently watching project: {project_id}. Cannot stop.")

    def stop_all_watchers():
        print(f"[WatchersManager-StopAll] Stopping all {len(active_plugins_map)} project watchers...")
        # Iterate over a copy of items for safe deletion from the map during iteration
        for project_id, plugin in list(active_plugins_map.items()): # project_id is int from map keys
            print(f"[WatchersManager-StopAll] Stopping watcher for project: {project_id}")
            plugin["stop"]()
            active_plugins_map.pop(project_id, None) # Ensure it's removed
        print("[WatchersManager-StopAll] All project watchers have been stopped and cleared from active map.")

    return {
        "start_watching_project": start_watching_project,
        "stop_watching_project": stop_watching_project,
        "stop_all_watchers": stop_all_watchers
    }