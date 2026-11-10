"""Text sanitization and fingerprint helpers."""

from __future__ import annotations

import hashlib
import re
import unicodedata


_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MULTI_SPACE = re.compile(r"[ \t]{2,}")
_MULTI_NEWLINE = re.compile(r"\n{3,}")
INJECTION_PATTERNS = [
    r"ignore (all|any|previous|prior) instructions",
    r"reveal (your|the) (system )?prompt",
    r"disregard (the )?rules",
    r"<\s*/?\s*system\s*>",
]


def sanitize_text(text: str, *, max_length: int | None = None) -> str:
    if not text:
        return ""
    cleaned = unicodedata.normalize("NFKC", text)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = _CONTROL_CHARS.sub("", cleaned)
    cleaned = _MULTI_SPACE.sub(" ", cleaned)
    cleaned = _MULTI_NEWLINE.sub("\n\n", cleaned).strip()
    if max_length is not None and len(cleaned) > max_length:
        cleaned = cleaned[:max_length].rstrip()
    return cleaned


def sanitize_user_text(text: str, max_len: int = 5000) -> str:
    return sanitize_text(text, max_length=max_len)


def strip_prompt_injection(text: str) -> str:
    result = text or ""
    for pattern in INJECTION_PATTERNS:
        result = re.sub(pattern, "[filtered]", result, flags=re.IGNORECASE)
    return result


def fingerprint_text(text: str) -> str:
    normalized = sanitize_text(text).encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()


def content_fingerprint(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()[:16]


def estimate_token_count(text: str) -> int:
    if not text:
        return 0
    return max(1, (len(text) + 3) // 4)


def estimate_tokens(text: str) -> int:
    return max(1, len((text or "").split()))


def truncate_for_log(text: str, max_chars: int = 120) -> str:
    cleaned = sanitize_text(text)
    if len(cleaned) <= max_chars:
        return cleaned
    return f"{cleaned[:max_chars]}…"
