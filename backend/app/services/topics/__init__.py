"""Topic extraction services."""

from app.services.topics.extractor import TopicMapExtractor, extract_topic_map
from app.services.topics.past_paper_mapper import update_past_paper_frequencies

__all__ = ["TopicMapExtractor", "extract_topic_map", "update_past_paper_frequencies"]
