from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.provider_key_schemas import (
    ProviderKey,
    CreateProviderKeyBody,
    UpdateProviderKeyBody,
    ProviderKeyListResponse
)
from app.utils.storage.provider_key_storage import provider_key_storage_util, ProviderKeysStorage

class ProviderKeyService:
    async def create_key(self, data: CreateProviderKeyBody) -> ProviderKey:
        all_keys = await provider_key_storage_util.read_provider_keys()
        now_ms = provider_key_storage_util.generate_id()
        key_id = provider_key_storage_util.generate_id()

        new_key_data_dict = {
            "id": key_id,
            "provider": data.provider,
            "key": data.key,
            "created": now_ms,
            "updated": now_ms,
        }
        try:
            new_key = ProviderKey.model_validate(new_key_data_dict)
        except ValidationError as e:
            raise HTTPException(status_code=500, detail={"message": "Internal validation error creating provider key.", "code": "PROVIDER_KEY_VALIDATION_ERROR", "errors": e.errors()})

        if new_key.id in all_keys:
            raise HTTPException(status_code=500, detail={"message": f"Provider key ID conflict for {new_key.id}", "code": "PROVIDER_KEY_ID_CONFLICT"})

        all_keys[new_key.id] = new_key
        await provider_key_storage_util.write_provider_keys(all_keys)
        return new_key

    async def list_keys(self) -> List[ProviderKeyListResponse.ProviderKeyListItem]:
        all_keys = await provider_key_storage_util.read_provider_keys()
        key_list = list(all_keys.values())
        key_list.sort(key=lambda k: k.created, reverse=True)
        key_list.sort(key=lambda k: k.provider)
        
        list_items = []
        for key in key_list:
            list_item = ProviderKeyListResponse.ProviderKeyListItem(
                id=key.id,
                provider=key.provider,
                created=key.created,
                updated=key.updated
            )
            list_items.append(list_item)
        return list_items

    async def get_key_by_id(self, key_id: int) -> Optional[ProviderKey]:
        all_keys = await provider_key_storage_util.read_provider_keys()
        return all_keys.get(key_id)

    async def get_keys_by_provider(self, provider_name: str) -> List[ProviderKey]:
        all_keys = await provider_key_storage_util.read_provider_keys()
        provider_specific_keys = [key for key in all_keys.values() if key.provider == provider_name]
        provider_specific_keys.sort(key=lambda k: k.created, reverse=True)
        return provider_specific_keys

    async def list_all_key_details(self) -> List[ProviderKey]:
        all_keys = await provider_key_storage_util.read_provider_keys()
        key_list = list(all_keys.values())
        key_list.sort(key=lambda k: k.created, reverse=True)
        key_list.sort(key=lambda k: k.provider)
        return key_list

    async def update_key(self, key_id: int, data: UpdateProviderKeyBody) -> ProviderKey:
        all_keys = await provider_key_storage_util.read_provider_keys()
        existing_key = all_keys.get(key_id)
        if not existing_key:
            raise HTTPException(status_code=404, detail={"message": f"Provider key with ID {key_id} not found for update.", "code": "PROVIDER_KEY_NOT_FOUND_FOR_UPDATE"})

        update_data_dict = data.model_dump(exclude_unset=True)
        updated_key_data = existing_key.model_copy(update=update_data_dict)
        updated_key_data.updated = provider_key_storage_util.generate_id()
        try:
            ProviderKey.model_validate(updated_key_data.model_dump())
        except ValidationError as e:
            raise HTTPException(status_code=500, detail={"message": "Internal validation error updating provider key.", "code": "PROVIDER_KEY_UPDATE_VALIDATION_ERROR", "errors": e.errors()})

        all_keys[key_id] = updated_key_data
        await provider_key_storage_util.write_provider_keys(all_keys)
        return updated_key_data

    async def delete_key(self, key_id: int) -> bool:
        all_keys = await provider_key_storage_util.read_provider_keys()
        if key_id not in all_keys:
            return False
        del all_keys[key_id]
        await provider_key_storage_util.write_provider_keys(all_keys)
        return True

# Instantiate the service for use in routes
provider_key_service = ProviderKeyService()
