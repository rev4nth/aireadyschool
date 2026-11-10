"""Supabase Storage helpers using the service role key."""

from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Any
from uuid import UUID, uuid4

from supabase import Client, create_client

from app.core.config import get_settings
from app.core.exceptions import AppError

logger = logging.getLogger(__name__)


@lru_cache
def get_supabase_admin() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def build_storage_path(user_id: UUID, filename: str, *, document_id: UUID | None = None) -> str:
    safe_name = filename.replace("\\", "/").split("/")[-1]
    safe_name = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in safe_name)
    return f"{user_id}/{document_id or uuid4()}/{safe_name}"


async def upload_bytes(storage_path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    if not data:
        raise AppError("Cannot upload empty file", status_code=400, code="empty_upload")
    settings = get_settings()
    client = get_supabase_admin()

    def _upload() -> None:
        client.storage.from_(settings.storage_bucket).upload(
            path=storage_path,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"},
        )

    try:
        await asyncio.to_thread(_upload)
    except Exception as exc:  # noqa: BLE001
        logger.exception("storage.upload_failed path=%s", storage_path)
        raise AppError(
            "Failed to upload file to storage",
            status_code=502,
            code="storage_upload_failed",
        ) from exc
    logger.info("storage.uploaded path=%s bytes=%s", storage_path, len(data))
    return storage_path


async def download_bytes(storage_path: str) -> bytes:
    settings = get_settings()
    client = get_supabase_admin()

    def _download() -> bytes:
        return client.storage.from_(settings.storage_bucket).download(storage_path)

    try:
        data = await asyncio.to_thread(_download)
    except Exception as exc:  # noqa: BLE001
        raise AppError(
            "Failed to download file from storage",
            status_code=502,
            code="storage_download_failed",
        ) from exc
    if not data:
        raise AppError("Stored file is empty", status_code=404, code="storage_empty")
    return data


async def delete_object(storage_path: str) -> None:
    if not storage_path:
        return
    settings = get_settings()
    client = get_supabase_admin()

    def _delete() -> None:
        client.storage.from_(settings.storage_bucket).remove([storage_path])

    try:
        await asyncio.to_thread(_delete)
        logger.info("storage.deleted path=%s", storage_path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("storage.delete_failed path=%s error=%s", storage_path, type(exc).__name__)
        raise AppError(
            "Failed to delete file from storage",
            status_code=502,
            code="storage_delete_failed",
        ) from exc


class MaterialStorage:
    """OO helper wrapping the async storage functions."""

    def upload(
        self,
        *,
        user_id: UUID,
        filename: str,
        data: bytes,
        content_type: str = "application/pdf",
        document_id: UUID | None = None,
    ) -> str:
        path = build_storage_path(user_id, filename, document_id=document_id)
        settings = get_settings()
        client = get_supabase_admin()
        file_options: dict[str, Any] = {"content-type": content_type, "upsert": "true"}
        client.storage.from_(settings.storage_bucket).upload(
            path=path, file=data, file_options=file_options
        )
        return path

    def download(self, storage_path: str) -> bytes:
        settings = get_settings()
        data = get_supabase_admin().storage.from_(settings.storage_bucket).download(storage_path)
        if not data:
            raise AppError("Stored file is empty", status_code=404, code="storage_empty")
        return data

    def delete(self, storage_path: str) -> None:
        settings = get_settings()
        get_supabase_admin().storage.from_(settings.storage_bucket).remove([storage_path])
