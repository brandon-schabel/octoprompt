#!/usr/bin/env python3
# packages/python_backend/main.py
# Last 5 changes:
# 1. Initial migration from server.ts and app.ts to main.py with FastAPI.
# 2. Ported server logic (static files, WebSockets, startup tasks).
# 3. Ported Hono app logic (FastAPI setup, middleware, error handlers, OpenAPI docs).
# 4. Adapted constants, environment settings, and utility functions (KV store, path handling).
# 5. Implemented stubs for services (WatchersManager, CleanupService) and placeholder routes.

import os
import json
import signal
import asyncio
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, Callable
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request, WebSocket, HTTPException, status as http_status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from pydantic import BaseModel, ValidationError, Field
from app.error_handling.api_error import ApiError

# --- Configuration & Constants ---
IS_DEV_ENV = os.getenv("NODE_ENV", "development") == "development"
SERVER_PORT = int(os.getenv("PORT", os.getenv("SERVER_PORT", "8000")))

# Project root assumed to be parent of 'python_backend' directory (where main.py lives)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Path to client distributables, mimicking original logic
# Original TS: isDevEnv ? join(import.meta.dir, 'client-dist') : './client-dist'
# 'import.meta.dir' for server.ts was 'packages/server/'.
# './client-dist' (prod) means relative to CWD, interpreted here as relative to project root.
if IS_DEV_ENV:
    CLIENT_PATH = PROJECT_ROOT / "server" / "client-dist"
else:
    CLIENT_PATH = PROJECT_ROOT / "client-dist" # Or adjust if build places it elsewhere, e.g. PROJECT_ROOT / "dist" / "client-dist"

# Ensure CLIENT_PATH exists or create a dummy for graceful failure/warning
if not CLIENT_PATH.exists():
    print(f"Warning: CLIENT_PATH {CLIENT_PATH} does not exist. Static file serving may fail.")
    # Fallback to a local dummy if needed, or handle error appropriately
    # CLIENT_PATH.mkdir(parents=True, exist_ok=True) # Example: create if it must exist
    # (CLIENT_PATH / "index.html").touch(exist_ok=True)


STATIC_FILE_REGEX = re.compile(r"\.(js|css|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$", re.IGNORECASE)
FRONTEND_ENDPOINTS = ["/projects", "/chat"] # SPA routes that serve index.html

# --- Pydantic Schemas (Shared Schemas Equivalents) ---
class ErrorDetailSchema(BaseModel):
    message: str
    code: str
    details: Optional[Union[Dict[str, Any], List[Any]]] = None

class ApiErrorResponseSchema(BaseModel):
    success: bool = False
    error: ErrorDetailSchema
# --- Package Info ---
package_info = {"name": "OctoPrompt FastAPI Python Server", "version": "0.5.3"}
PACKAGE_JSON_PATH = PROJECT_ROOT / "package.json"
if PACKAGE_JSON_PATH.exists():
    try:
        with open(PACKAGE_JSON_PATH, 'r') as f: data = json.load(f)
        package_info["name"] = data.get("name", package_info["name"])
        package_info["version"] = data.get("version", package_info["version"])
    except json.JSONDecodeError: print(f"Warning: Could not parse {PACKAGE_JSON_PATH}")


# --- Helper Functions ---
def format_pydantic_errors(error: ValidationError) -> Dict[str, List[str]]:
    errors: Dict[str, List[str]] = {}
    for err in error.errors():
        loc_key = ".".join(map(str, err['loc'])) if err['loc'] else "_form"
        errors.setdefault(loc_key, []).append(err['msg'])
    return errors

# --- Project Service (Stub) ---
async def list_projects() -> List[Dict[str, Any]]:
    print("Stub: Listing projects.")
    return [{"id": "proj1", "name": "Sample Project", "path": "/path/to/project1"}] # Placeholder

# --- File Sync Service (Stubs) ---
class WatchersManager: # DRY, SRP: This class encapsulates watcher logic.
    async def start_watching_project(self, project: Dict[str, Any], ignores: List[str]): # KISS: Simple stub.
        print(f"Stub: Start watching {project.get('name')}, ignoring {ignores}")
        await asyncio.sleep(0.01) # Simulate async non-blocking call
    def stop_all_watchers(self): print("Stub: Stop all watchers")

watchers_manager = WatchersManager()

class CleanupService: # DRY, SRP: Encapsulates cleanup task.
    def __init__(self, interval_ms: int): self.interval_s, self._task = interval_ms / 1000, None
    async def _run(self):
        while True: await asyncio.sleep(self.interval_s); print("Stub: Cleanup service pulse.")
    def start(self): self._task = asyncio.create_task(self._run()); print("Stub: Cleanup service started.")
    def stop(self):
        if self._task: self._task.cancel(); print("Stub: Cleanup service stopped.")

cleanup_service = CleanupService(interval_ms=5 * 60 * 1000)


# --- FastAPI App Setup (Hono App Equivalent) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Server starting up...")
    await initialize_services()
    print(f"Server running at http://localhost:{SERVER_PORT} (or host set in uvicorn)")
    print(f"Swagger UI: http://localhost:{SERVER_PORT}/swagger | OpenAPI Spec: http://localhost:{SERVER_PORT}/doc")
    
    yield # Application runs here
    
    # Shutdown
    print("Server shutting down...")
    watchers_manager.stop_all_watchers()
    cleanup_service.stop()
    # Cancel any other outstanding asyncio tasks if necessary
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    if tasks:
        print(f"Cancelling {len(tasks)} outstanding tasks...")
        for task in tasks: task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    print("Server shutdown complete.")

app = FastAPI(
    title=package_info["name"], version=package_info["version"],
    description=package_info.get("description", "OctoPrompt OpenAPI Python Server Spec"),
    openapi_url="/doc", # To match original /doc for spec
    default_response_class=JSONResponse,
    lifespan=lifespan # Use the lifespan context manager,
    
)

# CORS Middleware (from app.ts corsConfig)
# Determine allowed origins based on environment
_allowed_origins: List[str] = []
if IS_DEV_ENV:
    _allowed_origins = [
        "http://localhost:5173",  # React dev server
        "https://localhost:5173", # React dev server (HTTPS)
        # Consider adding the API's own origin if needed for tools like Swagger UI making requests from browser:
        # f"http://localhost:{SERVER_PORT}",
        # f"http://127.0.0.1:{SERVER_PORT}",
    ]
else:
    # Production: Configure via an environment variable for security.
    # Example: ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
    prod_origins_env = os.getenv("ALLOWED_ORIGINS")
    if prod_origins_env:
        _allowed_origins = [origin.strip() for origin in prod_origins_env.split(',')]
    else:
        # Fallback to wildcard if no env var is set.
        # WARNING: This is insecure for production. Set ALLOWED_ORIGINS.
        print("Warning: ALLOWED_ORIGINS environment variable not set. Defaulting to '*' for CORS, which is insecure for production.")
        _allowed_origins = ["*"]

# Ensure there's always a fallback if the list is empty (e.g. misconfiguration or empty env var)
if not _allowed_origins:
    print("Warning: CORS allowed origins list resolved to empty. Defaulting to '*'. Review your CORS configuration and ALLOWED_ORIGINS env var.")
    _allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True, # Allows cookies to be sent/received
    allow_methods=["*"],    # Allows all standard methods
    allow_headers=["*"]     # Allows all headers
)

# Logger Middleware (basic, from app.ts logger())
@app.middleware("http")
async def basic_logger_middleware(request: Request, call_next: Callable):
    print(f"Req: {request.method} {request.url.path}") # KISS: Simple logger
    response = await call_next(request)
    print(f"Res: {response.status_code}")
    return response

# --- FastAPI Error Handlers (Hono Error Handling Equivalents) ---
@app.exception_handler(ValidationError) # Default Zod-like hook for Pydantic
async def pydantic_validation_exception_handler(req: Request, exc: ValidationError):
    print(f"Validation Error: {exc.errors()}")
    return JSONResponse(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ApiErrorResponseSchema(error=ErrorDetailSchema(
            message="Validation Failed", code="VALIDATION_ERROR", details=format_pydantic_errors(exc)
        )).model_dump(exclude_none=True))

@app.exception_handler(ApiError) # Custom ApiError from shared/
async def custom_api_error_handler(req: Request, exc: ApiError):
    print(f"ApiError: {exc.status} - {exc.code} - {exc.message}")
    return JSONResponse(status_code=exc.status,
        content=ApiErrorResponseSchema(error=ErrorDetailSchema(
            message=exc.message, code=exc.code, details=exc.details
        )).model_dump(exclude_none=True))

@app.exception_handler(Exception) # Global error handler
async def generic_exception_handler(req: Request, exc: Exception):
    print(f"Generic Error: {type(exc).__name__}: {exc}")
    status, code, msg = 500, "INTERNAL_SERVER_ERROR", "Internal Server Error"
    details = {"type": type(exc).__name__, "error": str(exc)}
    if IS_DEV_ENV and hasattr(exc, '__traceback__'): details["traceback"] = str(exc.__traceback__)
        
    if isinstance(exc, HTTPException): # FastAPI/Starlette HTTP exceptions
        status, msg = exc.status_code, exc.detail
        code = "HTTP_EXCEPTION" # Generic code for these
    elif "not found" in str(exc).lower() or "does not exist" in str(exc).lower():
        status, code, msg = 404, "NOT_FOUND", str(exc)

    return JSONResponse(status_code=status,
        content=ApiErrorResponseSchema(error=ErrorDetailSchema(
            message=msg, code=code, details=details
        )).model_dump(exclude_none=True))


# --- API Routes (Ported from app.ts route registrations) ---
@app.get("/api/health", tags=["General"]) # KISS: Simple health check.
async def health_check(): return {"success": True}

# Placeholder for other route modules (chatRoutes, ticketRoutes, etc.)
# Example: from .routes.chat_routes import router as chat_router; app.include_router(chat_router, prefix="/api/chat")

# --- Import and include actual API routers ---
from app.api.endpoints.gen_ai_api import router as gen_ai_router
# TODO: Add other API routers as they are implemented:
# from app.api.endpoints.admin_api import router as admin_router
# from app.api.endpoints.chat_api import router as chat_router  
# from app.api.endpoints.prompt_api import router as prompt_router
# from app.api.endpoints.projects_api import router as project_router
# from app.api.endpoints.provider_key_api import router as provider_key_router
# from app.api.endpoints.ticket_api import router as ticket_router

app.include_router(gen_ai_router)

# --- WebSocket Endpoint (from server.ts) ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = os.urandom(16).hex() # crypto.randomUUID() equivalent
    await websocket.accept()
    print(f"WS Connection: {client_id}")
    try:
        while True:
            msg = await websocket.receive_text()
            print(f"WS Msg from {client_id}: {msg} (not processed)") # Original handler was empty
    except Exception as e: print(f"WS Error ({client_id}): {type(e).__name__} - {e}")
    finally: print(f"WS Closed: {client_id}")

# --- Static File Serving & SPA Fallback (from server.ts fetch logic) ---
def serve_static_or_index(path_str: str) -> FileResponse: # DRY for file serving logic
    # Security: Ensure path_str is relative and doesn't traverse up.
    # lstrip('/') ensures it's treated as relative to CLIENT_PATH.
    # Path resolution within CLIENT_PATH is generally safe.
    requested_file = (CLIENT_PATH / path_str.lstrip('/')).resolve()
    index_html = (CLIENT_PATH / "index.html").resolve()

    # Basic check to prevent path traversal if CLIENT_PATH is not correctly set or symlinked weirdly
    if CLIENT_PATH.resolve() not in requested_file.parents and requested_file != index_html:
         print(f"Warning: Potential path issue serving {path_str}. Serving index.html.")
         return FileResponse(index_html, media_type="text/html")

    if requested_file.is_file(): return FileResponse(requested_file)
    return FileResponse(index_html, media_type="text/html") # Fallback to index.html

@app.get("/", include_in_schema=False) # Serve index.html for root
async def serve_root_index_html(): return serve_static_or_index("index.html")

@app.get("/{path:path}", include_in_schema=False) # Catch-all for static assets and SPA
async def serve_static_files_or_spa_fallback(path: str):
    # API routes, WS, and root "/" are matched first. This handles remaining GET requests.
    # If path matches static file pattern or is a known SPA route, serve appropriately.
    # Otherwise, serve index.html for SPA.
    # The serve_static_or_index handles "try file, else index.html" logic.
    return serve_static_or_index(path)

# --- OpenAPI Docs UI (Swagger) ---
@app.get("/swagger", include_in_schema=False) # server.ts had /swagger for UI
async def custom_swagger_ui():
    return get_swagger_ui_html(openapi_url=app.openapi_url, title=f"{app.title} - Swagger UI")


# --- Server Lifecycle Events (Startup/Shutdown) ---
async def initialize_services(): # Modular function for startup tasks.
    projects = await list_projects()
    # Non-blocking start for watchers:
    # Original TODO: this seems to slow down server startup sometimes
    
    async def start_watchers_task(): # Wrap gather in a coroutine
        await asyncio.gather(*(
            watchers_manager.start_watching_project(p, ['node_modules', 'dist', '.git', '*.tmp', '*.db-journal'])
            for p in projects
        ))
    asyncio.create_task(start_watchers_task()) # Pass the coroutine to create_task
    cleanup_service.start()

# --- Main Execution Block ---
if __name__ == "__main__":
    # Uvicorn handles SIGINT/SIGTERM and triggers FastAPI's shutdown events.
    # idleTimeout from Bun server: uvicorn's --timeout-keep-alive (default 5s).
    # Bun's idleTimeout was 255s.
    print("Preparing to start server with Uvicorn...")
    uvicorn.run(
        app, # Could also be "main:app" as a string if preferred for auto-reload
        host="0.0.0.0", # Listen on all interfaces
        port=SERVER_PORT,
        log_level="info",
        timeout_keep_alive=255 # Matching Bun's idleTimeout
    )