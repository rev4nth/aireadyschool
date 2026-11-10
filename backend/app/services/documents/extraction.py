"""PDF text extraction with page numbers and heading hints (PyMuPDF)."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF

from app.core.exceptions import AppError
from app.services.rag.chunking import PageSection
from app.utils.text import sanitize_text

logger = logging.getLogger(__name__)

_HEADING_RE = re.compile(
    r"^(?:"
    r"chapter\s+\d+|"
    r"unit\s+\d+|"
    r"section\s+\d+(?:\.\d+)*|"
    r"\d+(?:\.\d+){0,3}\s+[A-Z].{0,80}|"
    r"[A-Z][A-Z0-9 \-:]{3,80}"
    r")$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ExtractedDocument:
    pages: list[PageSection]
    page_count: int
    title: str | None = None
    char_count: int = 0


def extract_pdf_bytes(data: bytes, *, filename: str | None = None) -> ExtractedDocument:
    if not data:
        raise AppError("PDF file is empty", status_code=400, code="empty_pdf")
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001
        raise AppError(
            "Unable to open PDF. Ensure the file is a valid PDF document.",
            status_code=400,
            code="invalid_pdf",
        ) from exc
    try:
        return _extract_from_doc(doc, filename=filename)
    finally:
        doc.close()


def extract_pdf_path(path: str | Path) -> ExtractedDocument:
    path = Path(path)
    if not path.exists():
        raise AppError(f"PDF not found: {path.name}", status_code=404, code="pdf_not_found")
    return extract_pdf_bytes(path.read_bytes(), filename=path.name)


def extract_plain_text(text: str, *, title: str | None = None) -> ExtractedDocument:
    cleaned = sanitize_text(text)
    if not cleaned:
        raise AppError(
            "No extractable text found. Scanned or image-only documents are not supported "
            "without OCR. Please upload a text-based PDF or paste text notes.",
            status_code=422,
            code="empty_extraction",
        )
    page = PageSection(text=cleaned, page_number=1, section_heading=title)
    return ExtractedDocument(pages=[page], page_count=1, title=title, char_count=len(cleaned))


def _extract_from_doc(doc: fitz.Document, *, filename: str | None) -> ExtractedDocument:
    pages: list[PageSection] = []
    current_heading: str | None = None
    total_chars = 0

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        cleaned = sanitize_text(page.get_text("text") or "")
        if not cleaned:
            continue
        heading = _detect_heading(cleaned) or current_heading
        if heading:
            current_heading = heading
        for section in _split_page_sections(cleaned, page_number=page_index + 1, default_heading=heading):
            total_chars += len(section.text)
            pages.append(section)

    if not pages or total_chars < 40:
        raise AppError(
            "This PDF appears to be scanned or contains no extractable text. "
            "GapFinder currently requires text-based PDFs (not image-only scans). "
            "Please upload a searchable PDF or paste the text content.",
            status_code=422,
            code="scanned_or_empty_pdf",
        )

    metadata = doc.metadata or {}
    meta_title = sanitize_text(str(metadata.get("title") or "")) or None
    logger.info("extraction.complete filename=%s pages=%s chars=%s", filename, doc.page_count, total_chars)
    return ExtractedDocument(
        pages=pages,
        page_count=doc.page_count,
        title=meta_title or filename,
        char_count=total_chars,
    )


def _detect_heading(text: str) -> str | None:
    for line in text.splitlines()[:8]:
        candidate = line.strip()
        if 3 <= len(candidate) <= 120 and _HEADING_RE.match(candidate):
            return candidate
    return None


def _split_page_sections(
    text: str,
    *,
    page_number: int,
    default_heading: str | None,
) -> list[PageSection]:
    lines = text.splitlines()
    sections: list[PageSection] = []
    buffer: list[str] = []
    heading = default_heading

    def flush() -> None:
        nonlocal buffer
        body = sanitize_text("\n".join(buffer))
        if body:
            sections.append(PageSection(text=body, page_number=page_number, section_heading=heading))
        buffer = []

    for line in lines:
        stripped = line.strip()
        if stripped and _HEADING_RE.match(stripped) and len(stripped) <= 120:
            flush()
            heading = stripped
            continue
        buffer.append(line)
    flush()
    return sections or [PageSection(text=text, page_number=page_number, section_heading=default_heading)]
