"""Cache key builders and service."""

from app.services.cache.keys import (
    gap_report_key,
    material_detail_key,
    materials_list_key,
    materials_user_pattern,
    quiz_cache_key,
    rag_answer_key,
    retrieval_cache_key,
    revision_plan_key,
    topic_map_key,
)
from app.services.cache.service import (
    CacheService,
    get_cache_service,
    get_json,
    invalidate_pattern,
    invalidate_user_material_caches,
    set_json,
)

__all__ = [
    "gap_report_key",
    "material_detail_key",
    "materials_list_key",
    "materials_user_pattern",
    "quiz_cache_key",
    "rag_answer_key",
    "retrieval_cache_key",
    "revision_plan_key",
    "topic_map_key",
    "CacheService",
    "get_cache_service",
    "get_json",
    "set_json",
    "invalidate_pattern",
    "invalidate_user_material_caches",
]
