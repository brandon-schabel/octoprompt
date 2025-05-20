## Key Directories Explained

```
python_backend/
├── pyproject.toml           # Python project definition, dependencies (Poetry/PDM)
├── README.md                # Overview of the Python backend
├── main.py                  # FastAPI app instantiation and server startup logic
├── .gitignore               # Specifies intentionally untracked files
├── app/                     # Main application package
│   ├── init.py
│   ├── api/                 # FastAPI routers and API endpoint definitions
│   │   ├── init.py
│   │   ├── endpoints/       # Individual endpoint modules (chats, projects, etc.)
│   │   │   ├── init.py
│   │   │   ├── chats.py
│   │   │   └── ... (other endpoint files)
│   │   └── routes.py        # Aggregates all routers from endpoints/
│   ├── services/            # Business logic, service layer interactions
│   │   ├── init.py
│   │   ├── chat_service.py
│   │   ├── agents/          # Logic for AI agents (coder, logger, etc.)
│   │   │   └── ...
│   │   ├── file_services/   # Services related to file system operations
│   │   │   └── ...
│   │   └── model_providers/ # Services for interacting with different AI model providers
│   │       └── ...
│   │   └── ... (other service files)
│   ├── schemas/             # Pydantic models for data validation and serialization
│   │   ├── init.py
│   │   ├── chat_schemas.py
│   │   └── ... (other schema definition files)
│   ├── utils/               # Utility functions and helper classes
│   │   ├── init.py
│   │   ├── path_utils.py
│   │   ├── storage/         # Utilities for data storage (JSON files, etc.)
│   │   │   └── ...
│   │   └── structured_outputs/ # Utilities for handling structured AI outputs
│   │       └── ...
│   │   └── ... (other utility files)
│   ├── constants/           # Application-wide constants and enumerations
│   │   ├── init.py
│   │   ├── server_config.py
│   │   └── ... (other constant files)
│   ├── core/                # Core application setup, configurations
│   │   ├── init.py
│   │   └── config.py        # Pydantic models for application settings (e.g., .env loading)
│   └── error_handling/      # Custom error classes and FastAPI exception handlers
│       ├── init.py
│       └── api_error.py
├── scripts/                 # Utility scripts for development (e.g., structure generation)
│   └── create_project_structure.py
├── tests/                   # Test suite (Pytest)
│   ├── init.py
│   ├── services/            # Tests for service layer
│   ├── utils/               # Tests for utility functions
│   ├── api/                 # Tests for API endpoints
│   ├── schemas/             # Tests for Pydantic schemas (e.g. validation logic)
│   └── conftest.py          # Pytest fixtures and global test configurations
├── docs/                    # Project-specific documentation for the Python backend
│   ├── project_structure.md # This file
│   ├── technology_mapping.md # Mapping from TypeScript stack to Python stack
│   └── testing_comparison.md # Comparison of testing approaches
└── prompts/                 # Markdown files containing prompts for AI agents
├── summarization-prompt.md
└── ... (other prompt files)
```

- **`app/`**: This is the heart of the application, containing all the core logic.
  - **`app/api/`**: Defines the HTTP API endpoints. `endpoints/` modules will contain `APIRouter` instances, which are then included in `app/api/routes.py` and subsequently in `main.py`.
  - **`app/services/`**: Contains the business logic. Services are called by API route handlers to perform operations.
  - **`app/schemas/`**: Holds Pydantic models. These are used for request/response validation in FastAPI and for defining data structures throughout the application. This directly maps to `packages/shared/src/schemas` in the TS version.
  - **`app/utils/`**: Contains helper functions and classes used across different parts of the application. This maps to both `packages/server/src/utils` and `packages/shared/src/utils`.
  - **`app/constants/`**: Stores constant values, enums, and configurations that don't change. This maps to `packages/server/src/constants` and `packages/shared/src/constants`.
  - **`app/core/config.py`**: Uses Pydantic's `BaseSettings` for managing application configurations, potentially loading from environment variables or `.env` files.
  - **`app/error_handling/`**: Defines custom exception classes (e.g., `ApiError`) and FastAPI exception handlers to provide consistent error responses.
- **`main.py`**: Initializes the FastAPI application, includes routers, and is the entry point for the ASGI server (like Uvicorn).
- **`pyproject.toml`**: Standard Python project file for managing dependencies (e.g., with Poetry or PDM) and project metadata. Replaces `package.json`.
- **`tests/`**: Contains all automated tests. `pytest` will discover and run tests from this directory.
- **`scripts/`**: For helper scripts related to the Python project development lifecycle.
- **`docs/`**: Contains markdown files with detailed explanations about the Python backend migration, structure, and technology choices.
- **`prompts/`**: Contains the same set of prompts as the original project, as these are typically language-agnostic Markdown files.
