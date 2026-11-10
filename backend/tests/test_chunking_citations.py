from uuid import uuid4

from app.services.rag.chunking import PageSection, chunk_pages, chunk_text
from app.services.rag.citations import validate_citation_ids


def test_chunk_text_creates_indexed_chunks():
    text = ("Recursion needs a base case. " * 80).strip()
    chunks = chunk_text(text)
    assert len(chunks) >= 1
    assert chunks[0].chunk_index == 0
    assert all(c.content for c in chunks)


def test_chunk_pages_preserve_page_metadata():
    pages = [
        PageSection(page_number=1, text="Intro " * 100, section_heading="Introduction"),
        PageSection(page_number=2, text="Recursion " * 100, section_heading="Recursion"),
    ]
    chunks = chunk_pages(pages)
    assert any(c.page_number == 1 for c in chunks)
    assert any(c.section_heading for c in chunks)


def test_validate_citations_rejects_unknown_ids(sample_chunks):
    real = sample_chunks[0].chunk_id
    fake = uuid4()
    validated = validate_citation_ids([str(real), str(fake), "not-a-uuid"], sample_chunks)
    assert len(validated) == 1
    assert validated[0].chunk_id == real
    assert validated[0].document_title == "Syllabus"
