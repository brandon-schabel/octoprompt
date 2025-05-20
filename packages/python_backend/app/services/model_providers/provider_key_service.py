from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.provider_key_schemas import (
    ProviderKey,
    CreateProviderKeyBody, # Corrected: Zod schema was CreateProviderKeyInputSchema, but body was CreateProviderKeyBodySchema
    UpdateProviderKeyBody
)
from app.utils.storage.provider_key_storage import provider_key_storage_util, ProviderKeysStorage

# Last 5 changes (from .ts):
# 1. Converted createKey, listKeys, getKeyById
# 2. Converted updateKey, deleteKey
# 3. Adapted error handling to FastAPI's HTTPException
# 4. Used Pydantic models for validation and data shaping
# 5. Aligned CreateProviderKeyInput with the Body schema used in TS routes

class ProviderKeyService:
    async def create_key(self, data: CreateProviderKeyBody) -> ProviderKey:
        all_keys = await provider_key_storage_util.read_provider_keys()
        now = datetime.now(timezone.utc)
        key_id = provider_key_storage_util.generate_id()

        new_key_data_dict = {
            "id": key_id,
            "provider": data.provider,
            "key": data.key, # Stored in plaintext
            "created_at": now,
            "updated_at": now,
        }

        try:
            new_key = ProviderKey.model_validate(new_key_data_dict)
        except ValidationError as e:
            print(f"Validation failed for new provider key data: {e.errors()}")
            # Consider specific error codes/messages based on your API design
            raise HTTPException(status_code=500, detail={"message": "Internal validation error creating provider key.", "code": "PROVIDER_KEY_VALIDATION_ERROR", "errors": e.errors()})

        if new_key.id in all_keys:
            raise HTTPException(status_code=500, detail={"message": f"Provider key ID conflict for {new_key.id}", "code": "PROVIDER_KEY_ID_CONFLICT"})

        all_keys[new_key.id] = new_key
        await provider_key_storage_util.write_provider_keys(all_keys)
        return new_key

    async def list_keys(self) -> List[ProviderKey]:
        all_keys = await provider_key_storage_util.read_provider_keys()
        key_list = list(all_keys.values())

        key_list.sort(key=lambda k: (k.provider, k.created_at), reverse=False) # provider asc, created_at asc (original was desc for created_at)
        # To match original: sort by provider asc, then by createdAt desc
        key_list.sort(key=lambda k: k.created_at, reverse=True)
        key_list.sort(key=lambda k: k.provider)
        return key_list

    async def get_key_by_id(self, key_id: str) -> Optional[ProviderKey]:
        all_keys = await provider_key_storage_util.read_provider_keys()
        found_key = all_keys.get(key_id)
        # Data should already be validated by read_validated_json in storage util
        return found_key # Returns ProviderKey or None

    async def update_key(self, key_id: str, data: UpdateProviderKeyBody) -> ProviderKey:
        all_keys = await provider_key_storage_util.read_provider_keys()
        existing_key = all_keys.get(key_id)

        if not existing_key:
            raise HTTPException(status_code=404, detail={"message": f"Provider key with ID {key_id} not found for update.", "code": "PROVIDER_KEY_NOT_FOUND_FOR_UPDATE"})

        update_data_dict = data.model_dump(exclude_unset=True) # Get only provided fields
        
        updated_key_data = existing_key.model_copy(update=update_data_dict)
        updated_key_data.updated_at = datetime.now(timezone.utc)

        try:
            # Re-validate the whole model. Pydantic will ensure type correctness.
            # UpdateProviderKeyBody also has a validator for at least one field being present.
            ProviderKey.model_validate(updated_key_data.model_dump())
        except ValidationError as e:
            print(f"Validation failed updating provider key {key_id}: {e.errors()}")
            raise HTTPException(status_code=500, detail={"message": "Internal validation error updating provider key.", "code": "PROVIDER_KEY_UPDATE_VALIDATION_ERROR", "errors": e.errors()})

        all_keys[key_id] = updated_key_data
        await provider_key_storage_util.write_provider_keys(all_keys)
        return updated_key_data

    async def delete_key(self, key_id: str) -> bool:
        all_keys = await provider_key_storage_util.read_provider_keys()
        if key_id not in all_keys:
            return False # Key not found, nothing to delete

        del all_keys[key_id]
        await provider_key_storage_util.write_provider_keys(all_keys)
        return True

# Instantiate the service for use in routes
provider_key_service = ProviderKeyService()
