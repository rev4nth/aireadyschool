"""Document extraction, storage, and processing."""

from app.services.documents.extraction import (
    ExtractedDocument,
    extract_pdf_bytes,
    extract_pdf_path,
    extract_plain_text,
)
from app.services.documents.processor import DocumentProcessor, process_document
from app.services.documents.storage import (
    MaterialStorage,
    build_storage_path,
    delete_object,
    download_bytes,
    get_supabase_admin,
    upload_bytes,
)

__all__ = [
    "ExtractedDocument",
    "extract_pdf_bytes",
    "extract_pdf_path",
    "extract_plain_text",
    "DocumentProcessor",
    "process_document",
    "MaterialStorage",
    "build_storage_path",
    "delete_object",
    "download_bytes",
    "get_supabase_admin",
    "upload_bytes",
]
