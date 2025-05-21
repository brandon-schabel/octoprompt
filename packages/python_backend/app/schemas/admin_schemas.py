from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import datetime
import platform
import psutil
import os
import sys
import time

# Changes:
# 1. Initial schema definitions for admin API.
# 2. Added EnvironmentInfo, ServerMemoryUsage, ServerInfo.
# 3. Added DatabaseStats, EnvInfoResponse.
# 4. Added SystemStatusResponse, ApiErrorDetail, ApiErrorResponse.
# 5. Made fields optional where appropriate and added example values.

class ApiErrorDetail(BaseModel):
    message: str
    code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class ApiErrorResponse(BaseModel):
    success: bool = Field(default=False, examples=[False])
    error: ApiErrorDetail

class EnvironmentInfo(BaseModel):
    PYTHON_ENV: Optional[str] = Field(default=None, examples=["development"])
    SERVER_PORT: Optional[str] = Field(default=None, examples=["8000"])
    # Add other relevant environment variables as needed

class ServerMemoryUsage(BaseModel):
    rss: int = Field(..., examples=[25000000])
    # Python's psutil provides different metrics than Node's process.memoryUsage()
    # We'll map what's available and makes sense.
    # heapTotal: Optional[int] = None # Not directly available
    # heapUsed: Optional[int] = None # Can be approximated by psutil.Process().memory_info().uss or similar
    # external: Optional[int] = None # Not directly available
    # arrayBuffers: Optional[int] = None # Not directly available
    vms: int = Field(..., examples=[50000000]) # Virtual Memory Size
    used_memory: int = Field(..., examples=[2000000000]) # system-wide used memory
    total_memory: int = Field(..., examples=[8000000000]) # system-wide total memory


class ServerInfo(BaseModel):
    python_version: str = Field(..., examples=["3.10.4"])
    platform: str = Field(..., examples=["darwin"])
    arch: str = Field(..., examples=["x86_64"])
    memory_usage: ServerMemoryUsage
    uptime: float = Field(..., examples=[3600.5]) # Process uptime in seconds

# Note: The TypeScript version defines DatabaseStatsSchema but doesn't populate it in the route.
# We define it here for completeness, but the initial route implementation will not populate it.
class DatabaseTableStat(BaseModel):
    count: int

class DatabaseStats(BaseModel):
    chats: Optional[DatabaseTableStat] = None
    chat_messages: Optional[DatabaseTableStat] = None
    projects: Optional[DatabaseTableStat] = None
    files: Optional[DatabaseTableStat] = None
    prompts: Optional[DatabaseTableStat] = None
    prompt_projects: Optional[DatabaseTableStat] = None
    provider_keys: Optional[DatabaseTableStat] = None
    tickets: Optional[DatabaseTableStat] = None
    ticket_files: Optional[DatabaseTableStat] = None
    ticket_tasks: Optional[DatabaseTableStat] = None
    file_changes: Optional[DatabaseTableStat] = None


class EnvInfoResponse(BaseModel):
    success: bool = Field(default=True, examples=[True])
    environment: EnvironmentInfo
    server_info: ServerInfo
    database_stats: Optional[DatabaseStats] = None # As per TS, this is included but not populated.

class SystemStatusChecks(BaseModel):
    api: str = Field(default="healthy", examples=["healthy"])
    timestamp: str = Field(..., examples=[datetime.datetime.now(datetime.timezone.utc).isoformat()])

class SystemStatusResponse(BaseModel):
    success: bool = Field(default=True, examples=[True])
    status: str = Field(default="operational", examples=["operational"])
    checks: SystemStatusChecks 