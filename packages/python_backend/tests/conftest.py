import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import time
from datetime import datetime, timezone

# If you need to consistently mock time across many tests,
# you could define a fixture here.
# For now, we'll mock time directly in test files or specific fixtures.

TEST_PROJECT_ID = 1234567890000
TEST_FILE_ID = 9876543210000

def mock_generate_id():
    return int(time.time_ns() / 1000000) # Similar to time.time() * 1000 but more unique for rapid calls

def get_fixed_timestamp():
    return int(datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)