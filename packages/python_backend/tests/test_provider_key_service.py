# tests/test_provider_key_service.py
# 1. Mock provider_key_storage_util extensively.
# 2. Test provider key CRUD operations.
# 3. Verify HTTPException is raised appropriately with correct codes/details.
# 4. Ensure IDs and timestamps are handled as int (Unix ms).
# 5. Test sorting logic in list_keys method.

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
import time
from pydantic import ValidationError

from app.services.provider_key_service import provider_key_service
from app.schemas.provider_key_schemas import (
    ProviderKey, CreateProviderKeyBody, UpdateProviderKeyBody
)

# Use fixed timestamps from a base for predictability
FIXED_SERVICE_TIMESTAMP_BASE = int(time.time() * 1000)
MOCK_SERVICE_KEY_ID_1 = FIXED_SERVICE_TIMESTAMP_BASE + 1000
MOCK_SERVICE_KEY_ID_2 = FIXED_SERVICE_TIMESTAMP_BASE + 1001
MOCK_NOW_TS = FIXED_SERVICE_TIMESTAMP_BASE

@pytest.fixture
def mock_provider_key_storage_util():
    with patch('app.services.provider_key_service.provider_key_storage_util', new_callable=AsyncMock) as mock_pksu:
        # Configure generate_id as a MagicMock for synchronous return values
        mock_pksu.generate_id = MagicMock(side_effect=[
            MOCK_NOW_TS, MOCK_SERVICE_KEY_ID_1, # For create_key (now_ms, key_id)
            MOCK_NOW_TS + 10, MOCK_SERVICE_KEY_ID_2, # Another create_key
            MOCK_NOW_TS + 20, # For update timestamp
            FIXED_SERVICE_TIMESTAMP_BASE + 4000, FIXED_SERVICE_TIMESTAMP_BASE + 4001,
            FIXED_SERVICE_TIMESTAMP_BASE + 4002, FIXED_SERVICE_TIMESTAMP_BASE + 4003,
        ])
        yield mock_pksu

@pytest.fixture
def sample_provider_key_data():
    return {
        "id": MOCK_SERVICE_KEY_ID_1,
        "provider": "openai",
        "key": "sk-test123456789",
        "created": MOCK_NOW_TS,
        "updated": MOCK_NOW_TS
    }

@pytest.fixture
def sample_provider_key_data_2():
    return {
        "id": MOCK_SERVICE_KEY_ID_2,
        "provider": "anthropic",
        "key": "sk-ant-test987654321",
        "created": MOCK_NOW_TS + 10,
        "updated": MOCK_NOW_TS + 10
    }

@pytest.mark.asyncio
async def test_create_key_success(mock_provider_key_storage_util, sample_provider_key_data):
    create_body = CreateProviderKeyBody(provider="openai", key="sk-test123456789")
    
    # generate_id will provide MOCK_SERVICE_KEY_ID_1, MOCK_NOW_TS
    expected_key_dict = {
        "id": MOCK_SERVICE_KEY_ID_1,
        "provider": create_body.provider,
        "key": create_body.key,
        "created": MOCK_NOW_TS,
        "updated": MOCK_NOW_TS
    }
    expected_key = ProviderKey(**expected_key_dict)

    mock_provider_key_storage_util.read_provider_keys.return_value = {}  # No existing keys
    mock_provider_key_storage_util.write_provider_keys.return_value = {MOCK_SERVICE_KEY_ID_1: expected_key}

    result = await provider_key_service.create_key(create_body)

    assert result.id == MOCK_SERVICE_KEY_ID_1
    assert result.provider == create_body.provider
    assert result.key == create_body.key
    assert result.created == MOCK_NOW_TS
    assert result.updated == MOCK_NOW_TS

    mock_provider_key_storage_util.read_provider_keys.assert_called_once()
    mock_provider_key_storage_util.write_provider_keys.assert_called_once_with({MOCK_SERVICE_KEY_ID_1: expected_key})

@pytest.mark.asyncio
async def test_create_key_id_conflict(mock_provider_key_storage_util):
    create_body = CreateProviderKeyBody(provider="openai", key="sk-test123")
    existing_key = ProviderKey(
        id=MOCK_SERVICE_KEY_ID_1, 
        provider="existing", 
        key="existing-key",
        created=MOCK_NOW_TS-100, 
        updated=MOCK_NOW_TS-100
    )
    mock_provider_key_storage_util.read_provider_keys.return_value = {MOCK_SERVICE_KEY_ID_1: existing_key}
    # generate_id will return MOCK_SERVICE_KEY_ID_1 as the first ID

    with pytest.raises(HTTPException) as excinfo:
        await provider_key_service.create_key(create_body)
    assert excinfo.value.status_code == 500
    assert excinfo.value.detail["code"] == "PROVIDER_KEY_ID_CONFLICT"

@pytest.mark.asyncio
async def test_list_keys_empty(mock_provider_key_storage_util):
    mock_provider_key_storage_util.read_provider_keys.return_value = {}
    
    result = await provider_key_service.list_keys()
    assert result == []

@pytest.mark.asyncio
async def test_list_keys_sorting(mock_provider_key_storage_util, sample_provider_key_data, sample_provider_key_data_2):
    # Create keys with different providers and timestamps to test sorting
    key1_data = sample_provider_key_data  # provider: "openai", created: MOCK_NOW_TS
    key2_data = sample_provider_key_data_2  # provider: "anthropic", created: MOCK_NOW_TS + 10
    key3_data = {
        "id": MOCK_SERVICE_KEY_ID_1 + 100,
        "provider": "openai", 
        "key": "sk-openai-newer",
        "created": MOCK_NOW_TS + 50,  # Newer than key1
        "updated": MOCK_NOW_TS + 50
    }
    
    key1 = ProviderKey(**key1_data)
    key2 = ProviderKey(**key2_data)
    key3 = ProviderKey(**key3_data)

    mock_provider_key_storage_util.read_provider_keys.return_value = {
        MOCK_SERVICE_KEY_ID_1: key1,
        MOCK_SERVICE_KEY_ID_2: key2,
        MOCK_SERVICE_KEY_ID_1 + 100: key3
    }

    result = await provider_key_service.list_keys()
    assert len(result) == 3
    
    # Should be sorted by provider asc, then by created desc within each provider
    assert result[0].provider == "anthropic"  # key2
    assert result[1].provider == "openai" and result[1].created == MOCK_NOW_TS + 50  # key3 (newer)
    assert result[2].provider == "openai" and result[2].created == MOCK_NOW_TS  # key1 (older)

@pytest.mark.asyncio
async def test_get_key_by_id_found(mock_provider_key_storage_util, sample_provider_key_data):
    key_obj = ProviderKey(**sample_provider_key_data)
    mock_provider_key_storage_util.read_provider_keys.return_value = {MOCK_SERVICE_KEY_ID_1: key_obj}
    
    result = await provider_key_service.get_key_by_id(MOCK_SERVICE_KEY_ID_1)
    assert result == key_obj

@pytest.mark.asyncio
async def test_get_key_by_id_not_found(mock_provider_key_storage_util):
    mock_provider_key_storage_util.read_provider_keys.return_value = {}
    
    result = await provider_key_service.get_key_by_id(MOCK_SERVICE_KEY_ID_1 + 999)
    assert result is None

@pytest.mark.asyncio
async def test_update_key_success(mock_provider_key_storage_util, sample_provider_key_data):
    original_key = ProviderKey(**sample_provider_key_data)
    mock_provider_key_storage_util.read_provider_keys.return_value = {MOCK_SERVICE_KEY_ID_1: original_key}
    
    update_body = UpdateProviderKeyBody(provider="anthropic", key="sk-ant-updated123")
    
    # Configure generate_id to return a specific timestamp for this test
    expected_updated_ts = MOCK_NOW_TS + 1000
    # Reset side_effect and set return_value
    mock_provider_key_storage_util.generate_id.side_effect = None
    mock_provider_key_storage_util.generate_id.return_value = expected_updated_ts
    
    async def mock_write_keys(keys_map):
        # Verify the updated key has correct values
        assert keys_map[MOCK_SERVICE_KEY_ID_1].provider == "anthropic"
        assert keys_map[MOCK_SERVICE_KEY_ID_1].key == "sk-ant-updated123"
        assert keys_map[MOCK_SERVICE_KEY_ID_1].updated > original_key.updated
        return keys_map
    mock_provider_key_storage_util.write_provider_keys.side_effect = mock_write_keys

    result = await provider_key_service.update_key(MOCK_SERVICE_KEY_ID_1, update_body)

    assert result.provider == "anthropic"
    assert result.key == "sk-ant-updated123"
    assert result.updated > original_key.updated
    
    mock_provider_key_storage_util.write_provider_keys.assert_called_once()

@pytest.mark.asyncio
async def test_update_key_partial_update(mock_provider_key_storage_util, sample_provider_key_data):
    original_key = ProviderKey(**sample_provider_key_data)
    mock_provider_key_storage_util.read_provider_keys.return_value = {MOCK_SERVICE_KEY_ID_1: original_key}
    
    # Only update the key, keep provider the same
    update_body = UpdateProviderKeyBody(key="sk-new-key-only")
    
    expected_updated_ts = MOCK_NOW_TS + 1000
    # Reset side_effect and set return_value
    mock_provider_key_storage_util.generate_id.side_effect = None
    mock_provider_key_storage_util.generate_id.return_value = expected_updated_ts
    
    async def mock_write_keys(keys_map):
        updated_key = keys_map[MOCK_SERVICE_KEY_ID_1]
        assert updated_key.provider == original_key.provider  # Should remain unchanged
        assert updated_key.key == "sk-new-key-only"  # Should be updated
        return keys_map
    mock_provider_key_storage_util.write_provider_keys.side_effect = mock_write_keys

    result = await provider_key_service.update_key(MOCK_SERVICE_KEY_ID_1, update_body)

    assert result.provider == original_key.provider
    assert result.key == "sk-new-key-only"

@pytest.mark.asyncio
async def test_update_key_not_found(mock_provider_key_storage_util):
    mock_provider_key_storage_util.read_provider_keys.return_value = {}  # Key does not exist
    
    update_body = UpdateProviderKeyBody(provider="updated", key="sk-updated-key")
    
    with pytest.raises(HTTPException) as excinfo:
        await provider_key_service.update_key(MOCK_SERVICE_KEY_ID_1 + 999, update_body)
    assert excinfo.value.status_code == 404
    assert excinfo.value.detail["code"] == "PROVIDER_KEY_NOT_FOUND_FOR_UPDATE"

@pytest.mark.asyncio
async def test_delete_key_success(mock_provider_key_storage_util, sample_provider_key_data):
    key_to_delete = ProviderKey(**sample_provider_key_data)
    mock_provider_key_storage_util.read_provider_keys.return_value = {MOCK_SERVICE_KEY_ID_1: key_to_delete}
    
    # Mock write to verify the key is removed
    mock_provider_key_storage_util.write_provider_keys = AsyncMock()

    result = await provider_key_service.delete_key(MOCK_SERVICE_KEY_ID_1)
    assert result is True

    # Verify key is removed from storage
    mock_provider_key_storage_util.write_provider_keys.assert_called_once()
    written_keys_arg = mock_provider_key_storage_util.write_provider_keys.call_args[0][0]
    assert MOCK_SERVICE_KEY_ID_1 not in written_keys_arg

@pytest.mark.asyncio
async def test_delete_key_not_found(mock_provider_key_storage_util):
    mock_provider_key_storage_util.read_provider_keys.return_value = {}  # Key does not exist
    
    result = await provider_key_service.delete_key(MOCK_SERVICE_KEY_ID_1 + 999)
    assert result is False
    
    # write_provider_keys should not be called for non-existent keys
    mock_provider_key_storage_util.write_provider_keys.assert_not_called()

@pytest.mark.asyncio
async def test_create_key_validation_error(mock_provider_key_storage_util):
    """Test handling of validation errors during key creation."""
    create_body = CreateProviderKeyBody(provider="openai", key="sk-test")
    
    mock_provider_key_storage_util.read_provider_keys.return_value = {}
    
    # Mock a validation error by patching ProviderKey.model_validate
    with patch('app.services.provider_key_service.ProviderKey.model_validate', side_effect=ValidationError.from_exception_data("test", [])):
        with pytest.raises(HTTPException) as excinfo:
            await provider_key_service.create_key(create_body)
        assert excinfo.value.status_code == 500
        assert excinfo.value.detail["code"] == "PROVIDER_KEY_VALIDATION_ERROR"

@pytest.mark.asyncio 
async def test_update_key_validation_error(mock_provider_key_storage_util, sample_provider_key_data):
    """Test handling of validation errors during key update."""
    original_key = ProviderKey(**sample_provider_key_data)
    mock_provider_key_storage_util.read_provider_keys.return_value = {MOCK_SERVICE_KEY_ID_1: original_key}
    
    update_body = UpdateProviderKeyBody(provider="updated", key="sk-updated-key")
    
    # Mock validation error during update
    with patch('app.services.provider_key_service.ProviderKey.model_validate', side_effect=ValidationError.from_exception_data("test", [])):
        with pytest.raises(HTTPException) as excinfo:
            await provider_key_service.update_key(MOCK_SERVICE_KEY_ID_1, update_body)
        assert excinfo.value.status_code == 500
        assert excinfo.value.detail["code"] == "PROVIDER_KEY_UPDATE_VALIDATION_ERROR"
