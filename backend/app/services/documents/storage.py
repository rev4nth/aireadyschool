"""Supabase Storage helpers via Storage REST API (supports new sb_secret_ keys)."""

from __future__ import annotations

import logging
from uuid import UUID, uuid4

import httpx

from app.core.config import get_settings
from app.core.exceptions import AppError

logger = logging.getLogger(__name__)


def build_storage_path(user_id: UUID, filename: str, *, document_id: UUID | None = None) -> str:
    safe_name = filename.replace("\\", "/").split("/")[-1]
    safe_name = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in safe_name)
    return f"{user_id}/{document_id or uuid4()}/{safe_name}"


def _headers(content_type: str | None = None) -> dict[str, str]:
    settings = get_settings()
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _object_url(storage_path: str) -> str:
    settings = get_settings()
    # Encode path segments but keep slashes as path separators.
    encoded = "/".join(httpx.URL(storage_path).raw_path.decode().lstrip("/").split("/"))
    # Prefer simple join; storage paths are already sanitized.
    return (
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
        f"{settings.storage_bucket}/{storage_path}"
    )


async def upload_bytes(storage_path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    if not data:
        raise AppError("Cannot upload empty file", status_code=400, code="empty_upload")

    url = _object_url(storage_path)
    headers = _headers(content_type)
    headers["x-upsert"] = "true"

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, headers=headers, content=data)
            if response.status_code in {200, 201}:
                logger.info("storage.uploaded path=%s bytes=%s", storage_path, len(data))
                return storage_path
            # Some projects expect PUT for upsert
            if response.status_code in {400, 409}:
                put = await client.put(url, headers=headers, content=data)
                if put.status_code in {200, 201}:
                    logger.info("storage.uploaded_put path=%s bytes=%s", storage_path, len(data))
                    return storage_path
                response = put
            raise AppError(
                f"Failed to upload file to storage ({response.status_code})",
                status_code=502,
                code="storage_upload_failed",
            )
    except AppError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("storage.upload_failed path=%s", storage_path)
        raise AppError(
            "Failed to upload file to storage",
            status_code=502,
            code="storage_upload_failed",
        ) from exc


async def download_bytes(storage_path: str) -> bytes:
    url = _object_url(storage_path)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(url, headers=_headers())
            if response.status_code != 200:
                raise AppError(
                    f"Failed to download file from storage ({response.status_code})",
                    status_code=502,
                    code="storage_download_failed",
                )
            data = response.content
    except AppError:
        raise
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
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{settings.storage_bucket}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                "DELETE",
                url,
                headers=_headers("application/json"),
                json={"prefixes": [storage_path]},
            )
            if response.status_code not in {200, 204}:
                logger.warning("storage.delete_failed status=%s", response.status_code)
    except Exception:  # noqa: BLE001
        logger.warning("storage.delete_failed path=%s", storage_path)
