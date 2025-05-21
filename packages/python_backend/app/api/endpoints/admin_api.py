from fastapi import APIRouter, HTTPException
from app.schemas.admin_schemas import (
    EnvInfoResponse,
    EnvironmentInfo,
    ServerInfo,
    ServerMemoryUsage,
    SystemStatusResponse,
    SystemStatusChecks,
    ApiErrorResponse,
    ApiErrorDetail,
    DatabaseStats # Imported, but not populated as per original TS
)
import os
import sys
import platform
import psutil
import time
import datetime

# Changes:
# 1. Initial router setup and endpoint definitions for admin API.
# 2. Implemented /env-info route.
# 3. Implemented /system-status route.
# 4. Added error handling for routes.
# 5. Ensured response schemas match Pydantic models.

router = APIRouter()

process = psutil.Process(os.getpid()) # Get current process for uptime and memory

@router.get(
    "/api/admin/env-info",
    response_model=EnvInfoResponse,
    tags=["Admin"],
    summary="Get system environment information and server statistics",
    responses={
        500: {"model": ApiErrorResponse, "description": "Error retrieving environment information"}
    }
)

async def get_env_info():
    try:
        env_info = EnvironmentInfo(
            PYTHON_ENV=os.environ.get("PYTHON_ENV") or os.environ.get("NODE_ENV"), # Checking both for compatibility
            SERVER_PORT=os.environ.get("SERVER_PORT") or os.environ.get("PORT")
        )

        mem_info = process.memory_info()
        system_mem = psutil.virtual_memory()
        
        server_mem_usage = ServerMemoryUsage(
            rss=mem_info.rss,
            vms=mem_info.vms,
            used_memory=system_mem.used,
            total_memory=system_mem.total
        )

        server_info = ServerInfo(
            python_version=sys.version.split()[0], # Get only the version number
            platform=platform.system().lower(),
            arch=platform.machine(),
            memory_usage=server_mem_usage,
            uptime=time.time() - process.create_time() # Process uptime
        )
        
        # DatabaseStats is part of the EnvInfoResponse schema but not populated
        # by the original TypeScript route. We follow that behavior here.
        # If db stats are needed, the logic to fetch them should be added.
        db_stats = DatabaseStats() # Empty or with default counts if desired

        return EnvInfoResponse(
            environment=env_info,
            server_info=server_info,
            database_stats=db_stats # Included but not populated
        )
    except Exception as e:
        print(f"Error in /api/admin/env-info: {e}")
        raise HTTPException(
            status_code=500,
            detail=ApiErrorDetail(message="Failed to get environment info", code="ENV_INFO_ERROR", details=str(e)).model_dump()
        )

@router.get(
    "/api/admin/system-status",
    response_model=SystemStatusResponse,
    tags=["Admin"],
    summary="Check system operational status",
    responses={
        500: {"model": ApiErrorResponse, "description": "Error retrieving system status"}
    }
)
async def get_system_status():
    try:
        status_checks = SystemStatusChecks(
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
        )
        return SystemStatusResponse(
            checks=status_checks
        )
    except Exception as e:
        print(f"Error in /api/admin/system-status: {e}")
        raise HTTPException(
            status_code=500,
            detail=ApiErrorDetail(message="Failed to get system status", code="SYSTEM_STATUS_ERROR", details=str(e)).model_dump()
        )

# To integrate this router into your main FastAPI application, you would typically do:
# from app.api.endpoints import admin_api
# app.include_router(admin_api.router)
