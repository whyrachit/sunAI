"""
SRT/subtitle content parser for TTS conversion.

Works on content that is IN SRT format regardless of the container file
(.txt, .docx, or actual .srt). Uses a line-by-line state machine so it
handles both proper SRT (single newlines within blocks) and Word-extracted
content where every paragraph is separated by double newlines.
"""

import re

_TS_RE = re.compile(r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})')
_TS_LINE_RE = re.compile(r'\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}')
_SEQ_NUM_RE = re.compile(r'^\d+$')
_HTML_TAG_RE = re.compile(r'<[^>]+>')


def _ts_to_ms(ts: str) -> int:
    m = _TS_RE.search(ts)
    if not m:
        return 0
    h, mi, s, ms = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
    return h * 3_600_000 + mi * 60_000 + s * 1_000 + ms


def _clean(text: str) -> str:
    return _HTML_TAG_RE.sub('', text).strip()


def looks_like_srt(text: str) -> bool:
    """True when text contains at least 2 SRT-style timestamp lines."""
    return len(_TS_LINE_RE.findall(text)) >= 2


def parse_srt_to_segments(
    content: str,
    max_pause_ms: int = 2000,
    min_pause_ms: int = 80,
) -> list[tuple[str, int]]:
    """
    Parse SRT-formatted text into (spoken_text, pause_after_ms) tuples.

    Uses a line-by-line state machine — works correctly whether lines within
    a block are separated by single newlines (pure .txt SRT) or double newlines
    (Word/docx where every paragraph becomes its own block).

    Sequence numbers and timestamps are stripped. Pause durations come from
    the actual timing gap between consecutive subtitle entries.
    """
    # Normalise line endings
    lines = content.replace('\r\n', '\n').replace('\r', '\n').splitlines()

    entries: list[tuple[int, int, str]] = []  # (start_ms, end_ms, text)

    # Use a single mutable dict so every read and write is in the same scope,
    # avoiding the closure-variable lint false-positives.
    cur: dict = {'start': 0, 'end': 0, 'texts': [], 'pending_flush': False}
    state = 'seek_num'   # seek_num | seek_ts | collect_text

    def _save_and_reset():
        if cur['texts']:
            entries.append((cur['start'], cur['end'], ' '.join(cur['texts'])))
        cur['texts'] = []
        cur['pending_flush'] = False

    def _set_ts(ts_line: str):
        parts = ts_line.split('-->', 1)
        cur['start'] = _ts_to_ms(parts[0])
        cur['end'] = _ts_to_ms(parts[1])
        cur['texts'] = []
        cur['pending_flush'] = False

    for raw_line in lines:
        line = raw_line.strip()

        if state == 'seek_num':
            if not line:
                continue
            if _SEQ_NUM_RE.match(line):
                state = 'seek_ts'
            elif _TS_LINE_RE.search(line):
                _set_ts(line)
                state = 'collect_text'

        elif state == 'seek_ts':
            if not line:
                continue
            if _TS_LINE_RE.search(line):
                _set_ts(line)
                state = 'collect_text'
            elif _SEQ_NUM_RE.match(line):
                pass  # repeated number, keep waiting for timestamp

        elif state == 'collect_text':
            if not line:
                # Defer flush — in docx-extracted content the subtitle text
                # arrives AFTER the blank line that follows the timestamp.
                cur['pending_flush'] = True

            elif _SEQ_NUM_RE.match(line):
                _save_and_reset()
                state = 'seek_ts'

            elif _TS_LINE_RE.search(line):
                _save_and_reset()
                _set_ts(line)

            else:
                cleaned = _clean(line)
                if not cleaned:
                    continue
                # If a blank was seen AND we already have text, it was a real
                # block boundary — flush before starting the next entry.
                # If we have NO text yet, the blank was just pre-text spacing
                # (docx style); keep collecting into the current entry.
                if cur['pending_flush'] and cur['texts']:
                    _save_and_reset()
                    state = 'seek_num'
                    continue   # text has no matching timestamp — skip it
                cur['pending_flush'] = False
                cur['texts'].append(cleaned)

    _save_and_reset()

    if not entries:
        return []

    # Build (text, pause_ms) pairs using actual inter-subtitle gaps
    segments: list[tuple[str, int]] = []
    for i, (start_ms, end_ms, text) in enumerate(entries):
        if i < len(entries) - 1:
            gap = entries[i + 1][0] - end_ms
            pause = max(min_pause_ms, min(gap, max_pause_ms))
        else:
            pause = 0
        segments.append((text, pause))

    return segments


def srt_to_plain_text(content: str) -> str:
    """Extract just the spoken text from SRT content, joined as plain text."""
    return ' '.join(t for t, _ in parse_srt_to_segments(content))
