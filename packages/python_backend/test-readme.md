## Python Unit Testing Guide

```markdown
# Unit Testing Guide for Project Services

This document outlines how to set up and run the unit tests for `project_storage.py` and `project_service.py` using `uv` and `pytest`.

## 1. Introduction

The unit tests are designed to verify the correctness of individual functions and methods within the project and file management services. They use `pytest` for test execution and `unittest.mock` for isolating components by mocking dependencies like file system operations and AI service calls.

## 2. Setup

### 2.1. Install `uv`

If you don't have `uv` installed, follow the official installation instructions from [astral.sh/uv](https://astral.sh/uv).

### 2.2. Project Structure

The tests assume a project structure where your application code (`app/...`) and the tests (`tests/...`) are organized. For example:

```

your_project/
├── packages/
│   └── python_backend/
│       └── app/
│           ├── schemas/
│           ├── services/
│           │   └── project_service.py
│           └── utils/
│               └── storage/
│                   └── project_storage.py
│               # ... other utilities
└── tests/
    ├── conftest.py         # Shared pytest fixtures (optional)
    ├── test_project_storage.py
    └── test_project_service.py

```
Ensure that your Python path is configured such that imports like `from app.services.project_service import ...` work correctly from within the `tests` directory. You might need an `__init__.py` in relevant directories to mark them as packages.

### 2.3. Install Dependencies

You'll need `pytest` and `pytest-asyncio` (since many functions are asynchronous). You can install these into your project's virtual environment managed by `uv`.

1.  **Create/Activate Virtual Environment (if not already done):**
    ```bash
    uv venv .venv  # Creates a virtual environment named .venv
    source .venv/bin/activate # Or .venv\Scripts\activate on Windows
    ```

2.  **Install test dependencies:**
    ```bash
    uv pip install pytest pytest-asyncio pydantic
    ```
    (`pydantic` is listed as it's a core dependency of the code under test and might be needed for test model definitions too).

## 3. Running Tests

To run the unit tests, navigate to the root directory of your `python_backend` (or the directory containing the `tests` folder and your `app` package) and execute:

```bash
uv run pytest
```

Alternatively, if you have activated the virtual environment:

```bash
pytest
```

**Expected Output:**
`pytest` will discover and run the tests in the `tests` directory. You should see output indicating the number of tests passed, failed, or skipped. Successful runs will show a summary like:
`============================= X_X passed in Y.YYs ==============================`

## 4. Test Suite Overview

### 4.1. `tests/test_project_storage.py`

This suite tests the `ProjectStorage` class from `app.utils.storage.project_storage.py`.

* **Key Areas Tested:**
  * **ID Generation**: Ensures `generate_id()` produces integer timestamps.
  * **File Path Logic**: Verifies correctness of functions like `get_projects_index_path()`.
  * **JSON I/O (`_read_validated_json`, `_write_validated_json`):**
    * Handles file not found, empty files, invalid JSON.
    * Validates data against Pydantic models (`Project`, `ProjectFile`, `AIFileChangeRecord`, and `RootModel` wrappers).
    * Correctly converts dictionary keys between `int` (in-memory) and `str` (in JSON).
  * **CRUD Operations**: Tests for projects, project files, and AI file change records (`read_*`, `write_*`, `update_*`).
  * **Directory Management**: `_ensure_dir_exists()` correctly calls `pathlib.Path.mkdir`.
  * **Data Deletion**: `delete_project_data()` correctly calls `shutil.rmtree`.
  * **Internal Model Validation**: Ensures the internal storage Pydantic models correctly convert string/datetime representations of IDs and timestamps to integers.
* **Key Mocks Used:**
  * `pathlib.Path` methods (`mkdir`, `exists`, `open`, etc.)
  * `builtins.open` for file reading/writing.
  * `json` module functions (implicitly, via Pydantic's `model_dump(mode='json')` and `json.loads` in tests).
  * `shutil.rmtree`.
  * `time.time` and `datetime.datetime.now` for predictable timestamps.

### 4.2. `tests/test_project_service.py`

This suite tests the functions within `app.services.project_service.py`.

* **Key Areas Tested:**
  * **Path Resolution (`resolve_path`):** Correctly resolves relative, absolute, and home-directory paths.
  * **Project Lifecycle**: `create_project`, `get_project_by_id`, `list_projects`, `update_project`, `delete_project`. Verifies logic for ID conflicts, not found errors, data validation, and interaction with `project_storage`.
  * **File Management**:
    * Single file operations: `get_project_files`, `update_file_content`, `create_project_file_record`.
    * Bulk operations: `bulk_create_project_files`, `bulk_update_project_files`, `bulk_delete_project_files`.
    * Retrieval: `get_project_files_by_ids`.
    * Ensures correct handling of `int` IDs, paths, content, and timestamps.
  * **Summarization Logic**:
    * `summarize_single_file`: Handles empty content, calls AI service, updates storage.
    * `summarize_files`: Batches summarization, handles errors and skips.
    * `resummarize_all_files`: Orchestrates full project re-summarization.
    * `remove_summaries_from_files`: Clears summary fields and updates storage.
  * **Input Optimization (`optimize_user_input`):** Calls project summary and AI service, returns optimized prompt.
  * **Error Handling**: Verifies that `ApiError` is raised with appropriate status codes and messages for various error conditions.
  * **Timestamp and ID Integrity**: Checks that `created` and `updated` timestamps, as well as `project_id` and `file_id`, are handled as integers.
* **Key Mocks Used:**
  * `project_storage` (instance of `ProjectStorage`): All interactions with the storage layer are mocked.
  * `app.services.gen_ai_service.generate_single_text` and `generate_structured_data`: AI service calls are mocked to return predefined responses.
  * `app.utils.get_full_project_summary.get_full_project_summary`.
  * `datetime.datetime.now` for predictable timestamps.
  * `app.utils.prompts_map.prompts_map` for prompt template retrieval.
  * `app.services.project_service.sync_project` (placeholder function).

## 5. Notes

* The tests rely on `pytest-asyncio` for handling `async` functions.
* Timestamps and IDs are critical; tests ensure they are generated and processed as `int` (Unix milliseconds).
* Mocking is extensive to ensure unit tests are isolated and fast.
* Remember to keep dependencies updated: `uv pip install -U pytest pytest-asyncio`.

```
