import fitz
import pytest

from app.core.exceptions import AppError
from app.services.documents.extraction import extract_pdf_bytes, extract_plain_text


def _pdf_with_text(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_extract_pdf_pages():
    data = _pdf_with_text("Chapter 1 Recursion base case and recursive case explained clearly.")
    extracted = extract_pdf_bytes(data)
    assert extracted.page_count == 1
    assert any("Recursion" in p.text for p in extracted.pages)


def test_scanned_pdf_message():
    doc = fitz.open()
    doc.new_page()
    data = doc.tobytes()
    doc.close()
    with pytest.raises(AppError) as exc:
        extract_pdf_bytes(data)
    assert "scanned" in exc.value.message.lower() or "extractable" in exc.value.message.lower()


def test_extract_plain_text():
    extracted = extract_plain_text("Hello study notes about trees and graphs.")
    assert extracted.pages[0].page_number == 1
