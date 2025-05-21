import asyncio
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List, Literal
import aiofiles

AGENT_LOGS_DIR = Path('./data/agent-logs')
ORCHESTRATOR_LOG_FILENAME = 'orchestrator-log.jsonl'
AGENT_DATA_FILENAME = 'agent-data.json'

# Global state for the logger
_log_file_writer: Optional[asyncio.StreamWriter] = None
_logger_initialized = False
_current_log_file_path: Optional[Path] = None

async def _ensure_log_dir_exists(dir_path: Path):
    try:
        await asyncio.to_thread(os.makedirs, dir_path, exist_ok=True)
    except Exception as e:
        print(f"Failed to create or access log directory: {dir_path}", e)
        raise

def get_orchestrator_log_file_paths(project_id: str, agent_job_id: str) -> Dict[str, Any]:
    job_log_dir = AGENT_LOGS_DIR / 'projects' / project_id / 'jobs' / agent_job_id
    # print(f"{{'ORCHESTRATOR_LOG_PATH': {job_log_dir / ORCHESTRATOR_LOG_FILENAME}}}") # Python equivalent of console.log({key:val})
    # await _ensure_log_dir_exists(job_log_dir) # ensure_log_dir_exists will be called in initialize_logger
    file_path = job_log_dir / ORCHESTRATOR_LOG_FILENAME
    return {"job_log_dir": job_log_dir, "file_path": file_path, "agent_job_id": agent_job_id}

async def get_agent_data_log_file_path(project_id: str, agent_job_id: str) -> Path:
    job_log_dir = AGENT_LOGS_DIR / 'projects' / project_id / 'jobs' / agent_job_id
    # print(f"{{'DATA_LOG_PATH': {job_log_dir / AGENT_DATA_FILENAME}}}")
    await _ensure_log_dir_exists(job_log_dir)
    return job_log_dir / AGENT_DATA_FILENAME

async def initialize_logger(orchestrator_log_file_path: Path):
    global _logger_initialized, _current_log_file_path, _log_file_writer

    if _logger_initialized and orchestrator_log_file_path == _current_log_file_path:
        return
    
    if _log_file_writer:
        try:
            _log_file_writer.close()
            await _log_file_writer.wait_closed()
            print(f"Closed previous logger for: {_current_log_file_path}")
        except Exception as e:
            print(f"Error closing previous logger: {_current_log_file_path}", e)
        _log_file_writer = None

    try:
        await _ensure_log_dir_exists(orchestrator_log_file_path.parent)
        
        # Open file in append mode with line buffering
        # Python's open doesn't directly return an asyncio.StreamWriter.
        # We will use a simple file handle and manage writes carefully.
        # For true async file I/O, libraries like aiofiles would be needed,
        # but for simplicity, we'll use to_thread for blocking I/O.
        # This approach simplifies, but loses the direct BunFile.writer() equivalent.
        # We will manage the file handle directly for write/flush.
        
        # Storing the file object directly is simpler than StreamWriter for this case
        # as Python's built-in file objects handle buffering.
        _f = open(orchestrator_log_file_path, 'a', buffering=1) # line-buffered
        _log_file_writer = _f # Keep type hint Optional[Any] or a custom protocol if needed

        _current_log_file_path = orchestrator_log_file_path

        start_log = json.dumps({
            "timestamp": datetime.utcnow().isoformat() + 'Z',
            "level": "info",
            "message": "--- Orchestrator Log Start ---"
        })
        await asyncio.to_thread(_log_file_writer.write, start_log + '\n')
        await asyncio.to_thread(_log_file_writer.flush) # Ensure start log is written

        print(f"Logging initialized. Orchestrator logs in {orchestrator_log_file_path}")
        _logger_initialized = True

    except Exception as e:
        print(f"FATAL: Failed to initialize file logger for {orchestrator_log_file_path}:", e)
        if _log_file_writer and hasattr(_log_file_writer, 'close'): # If it's a file handle
             _log_file_writer.close()
        _log_file_writer = None
        _current_log_file_path = None
        _logger_initialized = False
        raise

LogLevel = Literal['info', 'verbose', 'warn', 'error']

async def log(message: str, level: LogLevel = 'info', data: Optional[Dict[str, Any]] = None):
    global _logger_initialized, _log_file_writer
    if not _logger_initialized or not _log_file_writer:
        log_output = f"{level.upper()}: {message}"
        if data:
            try:
                log_output += f" {json.dumps(data)}"
            except TypeError:
                log_output += f" {str(data)} (Error serializing data to JSON)"
        print(f'[Logger not initialized/writer error] {log_output}')
        return

    timestamp = datetime.utcnow().isoformat() + 'Z' # Ensure UTC and Z for ISO 8601 compatibility
    log_entry: Dict[str, Any] = {"timestamp": timestamp, "level": level, "message": message}
    if data: log_entry["data"] = data
    
    json_log_line = ""
    try:
        json_log_line = json.dumps(log_entry)
    except TypeError as te:
        print(f"[Logger Serialization Error] Failed to serialize log data for message '{message}': {te}")
        # Fallback: try to serialize data with str() for problematic fields if possible, or just log message
        fallback_data = {k: str(v) for k, v in data.items()} if data else None
        log_entry_fallback: Dict[str, Any] = {"timestamp": timestamp, "level": level, "message": message}
        if fallback_data: log_entry_fallback["data_fallback"] = fallback_data
        log_entry_fallback["serialization_error"] = str(te)
        json_log_line = json.dumps(log_entry_fallback)

    try:
        # Assuming _log_file_writer is a file object opened in text mode
        await asyncio.to_thread(_log_file_writer.write, json_log_line + '\n')
        await asyncio.to_thread(_log_file_writer.flush) # Ensure it's written, similar to Bun's flush
    except Exception as e:
        print(f"[Logger File Write Error] {e}")
        # Fallback console logging
        log_output_fb = f"{level.upper()}: {message}"
        if data: log_output_fb += f" {json.dumps(data, default=str)} # Attempt to serialize with str for unhandled types"
        print(f'[File Log Failed] {log_output_fb}')

    # Console logging (skip verbose by default, similar to TS)
    if level != 'verbose':
        console_msg = message
        # if data: console_msg += f" {json.dumps(data, default=str)}" # Optionally include data in console too
        if level == 'info': print(console_msg)
        elif level == 'warn': print(f"WARNING: {console_msg}")
        elif level == 'error': print(f"ERROR: {console_msg}")

async def write_agent_data_log(project_id: str, agent_job_id: str, data: Any):
    file_path = await get_agent_data_log_file_path(project_id, agent_job_id)
    # print(f"{{'DATA_LOG_PATH': '{file_path}'}}") # Python equivalent of console.log({key:val})
    try:
        await _ensure_log_dir_exists(file_path.parent)
        async with aiofiles.open(file_path, mode='w') as f:
            await f.write(json.dumps(data, indent=2))
        print(f"Agent data log written to: {file_path}")
    except Exception as e:
        print(f"Failed to write agent data log to {file_path}:", e)

async def close_logger():
    global _logger_initialized, _log_file_writer, _current_log_file_path
    if _log_file_writer and hasattr(_log_file_writer, 'close'):
        try:
            await asyncio.to_thread(_log_file_writer.close)
            print(f"Logger closed for: {_current_log_file_path}")
        except Exception as e:
            print(f"Error closing logger for {_current_log_file_path}:", e)
        finally:
            _logger_initialized = False
            _log_file_writer = None
            _current_log_file_path = None

async def list_agent_jobs(project_id: str) -> List[str]:
    project_jobs_dir = AGENT_LOGS_DIR / 'projects' / project_id / 'jobs'
    try:
        if not await asyncio.to_thread(project_jobs_dir.is_dir):
            print(f"[Agent Logger] Project job directory not found: {project_jobs_dir}")
            return []
        
        entries = await asyncio.to_thread(os.listdir, project_jobs_dir)
        job_ids = [entry for entry in entries if (project_jobs_dir / entry).is_dir()]
        # print(f"[Agent Logger] Found {len(job_ids)} agent job directories in {project_jobs_dir}")
        return job_ids
    except FileNotFoundError:
        print(f"[Agent Logger] Root log directory or project directory not found during listing: {project_jobs_dir}")
        return []
    except Exception as e:
        print(f"[Agent Logger] Error listing agent job directories in {project_jobs_dir}:", e)
        raise # Re-throw for handling in the route or calling code
