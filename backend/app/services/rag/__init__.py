"""RAG retrieval and grounded generation."""

from app.services.rag.chunking import PageSection, TextChunk, chunk_pages, chunk_text
from app.services.rag.citations import (
    build_citations,
    citations_as_dicts,
    filter_chunk_id_list,
    validate_citation_ids,
    validate_citations,
)
from app.services.rag.pipeline import RAGPipeline, answer_study_question, build_grounded_context
from app.services.rag.retrieval import (
    HybridRetriever,
    RetrievedChunk,
    hybrid_retrieve,
    material_version_for_subject,
    retrieval_fingerprint,
)

__all__ = [
    "PageSection",
    "TextChunk",
    "chunk_pages",
    "chunk_text",
    "build_citations",
    "citations_as_dicts",
    "filter_chunk_id_list",
    "validate_citation_ids",
    "validate_citations",
    "RAGPipeline",
    "answer_study_question",
    "build_grounded_context",
    "HybridRetriever",
    "RetrievedChunk",
    "hybrid_retrieve",
    "material_version_for_subject",
    "retrieval_fingerprint",
]
