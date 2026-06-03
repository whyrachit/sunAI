import re

MAX_CHUNK_CHARS = 2500  # bulbul:v3 REST API limit

# Sentence-ending punctuation (covers Latin scripts + Devanagari danda)
_SENTENCE_END = re.compile(r'(?<=[.!?।\n])\s+')


def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """Split text into chunks ≤ max_chars, breaking at sentence boundaries where possible."""
    text = text.strip()
    if not text:
        return []

    if len(text) <= max_chars:
        return [text]

    # Split into sentences first
    sentences = _split_sentences(text)

    chunks = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Single sentence longer than limit — must hard-split it
        if len(sentence) > max_chars:
            if current:
                chunks.append(current.strip())
                current = ""
            for part in _hard_split(sentence, max_chars):
                chunks.append(part)
            continue

        if len(current) + len(sentence) + 1 <= max_chars:
            current = (current + " " + sentence).strip() if current else sentence
        else:
            if current:
                chunks.append(current.strip())
            current = sentence

    if current:
        chunks.append(current.strip())

    return [c for c in chunks if c]


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences while preserving the delimiter."""
    parts = _SENTENCE_END.split(text)
    # Re-attach trailing punctuation that got split
    sentences = []
    buffer = ""
    for part in parts:
        buffer = (buffer + " " + part).strip() if buffer else part
        if re.search(r'[.!?।]$', buffer):
            sentences.append(buffer)
            buffer = ""
    if buffer:
        sentences.append(buffer)
    return sentences


def _hard_split(text: str, max_chars: int) -> list[str]:
    """Split oversized text at word boundaries."""
    words = text.split()
    parts = []
    current = ""
    for word in words:
        if len(current) + len(word) + 1 <= max_chars:
            current = (current + " " + word).strip() if current else word
        else:
            if current:
                parts.append(current)
            current = word
    if current:
        parts.append(current)
    return parts
