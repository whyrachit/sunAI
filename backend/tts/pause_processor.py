"""
Natural pause logic for e-learning TTS.

Since bulbul:v3 has no SSML support, we implement pauses at the audio layer:
- Split text at paragraph boundaries
- Generate PCM silence WAV between segments
- Concatenate everything with Python's built-in wave module (no ffmpeg needed)
"""

import io
import re
import wave

_PARA_SPLIT = re.compile(r'\n\s*\n')


def split_into_pause_segments(
    text: str,
    max_chunk_chars: int = 2400,
    paragraph_pause_ms: int = 900,
) -> list[tuple[str, int]]:
    """
    Return list of (text_segment, pause_after_ms).

    Each paragraph becomes its own TTS segment. The bulbul:v3 engine handles
    intra-paragraph punctuation pauses naturally; we only add explicit silence
    at paragraph/chunk boundaries so learners can absorb each idea.
    """
    paragraphs = [p.strip() for p in _PARA_SPLIT.split(text) if p.strip()]
    if not paragraphs:
        return []

    from tts.chunker import chunk_text

    # Greedily PACK consecutive paragraphs into chunks up to max_chunk_chars.
    # Without this, every paragraph became its own TTS request — a transcript or
    # SRT-derived document (one short line per paragraph) would fire hundreds of
    # sequential API calls, taking many minutes per file. Packing turns that into
    # a handful of calls. Paragraph boundaries inside a packed chunk are kept as
    # blank lines so the engine still hears them; explicit silence is inserted
    # between chunks.
    chunks: list[str] = []
    buf: list[str] = []
    buf_len = 0

    def _flush():
        nonlocal buf, buf_len
        if buf:
            chunks.append('\n\n'.join(buf))
            buf = []
            buf_len = 0

    for para in paragraphs:
        if len(para) > max_chunk_chars:
            # A single oversized paragraph: flush what we have, then sentence-chunk it.
            _flush()
            chunks.extend(chunk_text(para, max_chunk_chars))
            continue
        add_len = len(para) + (2 if buf else 0)
        if buf and buf_len + add_len > max_chunk_chars:
            _flush()
            add_len = len(para)
        buf.append(para)
        buf_len += add_len

    _flush()

    # Pause after every chunk except the last.
    return [(c, paragraph_pause_ms if i < len(chunks) - 1 else 0) for i, c in enumerate(chunks)]


def generate_silence_wav(duration_ms: int, sample_rate: int = 24000, channels: int = 1) -> bytes:
    """Generate PCM silence as a WAV byte string. Pure Python, no external deps."""
    if duration_ms <= 0:
        return b''
    num_samples = int(sample_rate * duration_ms / 1000)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)       # 16-bit PCM
        wf.setframerate(sample_rate)
        wf.writeframes(b'\x00' * num_samples * channels * 2)
    return buf.getvalue()


def concatenate_wavs(wav_list: list[bytes]) -> bytes:
    """
    Concatenate WAV byte strings into one.
    All inputs must share the same setnchannels/setsampwidth/setframerate params,
    which is guaranteed when they all come from the same API sample_rate setting.
    """
    non_empty = [w for w in wav_list if w]
    if not non_empty:
        return b''

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as out:
        params_written = False
        for wav_bytes in non_empty:
            with wave.open(io.BytesIO(wav_bytes), 'rb') as inp:
                if not params_written:
                    out.setparams(inp.getparams())
                    params_written = True
                out.writeframes(inp.readframes(inp.getnframes()))
    return buf.getvalue()


def try_wav_to_mp3(wav_bytes: bytes, bitrate: str = "128k") -> bytes | None:
    """
    Convert WAV bytes to MP3 using lameenc (pure LAME, zero ffmpeg needed!).
    Returns None if lameenc is not installed or conversion fails.
    """
    try:
        import wave
        import io as _io
        import lameenc
        
        # Read WAV headers and PCM data
        wav_io = _io.BytesIO(wav_bytes)
        with wave.open(wav_io, 'rb') as wav:
            channels = wav.getnchannels()
            sample_rate = wav.getframerate()
            num_frames = wav.getnframes()
            pcm_data = wav.readframes(num_frames)
            
        # Parse bitrate string (e.g. "128k" -> 128)
        br_val = 128
        if isinstance(bitrate, str) and bitrate.endswith('k'):
            try:
                br_val = int(bitrate[:-1])
            except ValueError:
                br_val = 128
        elif isinstance(bitrate, int):
            br_val = bitrate
            
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(br_val)
        encoder.set_in_sample_rate(sample_rate)
        encoder.set_channels(channels)
        encoder.set_quality(2)  # 2 = high quality / near-best, recommended default

        mp3_bytes = encoder.encode(pcm_data)
        mp3_bytes += encoder.flush()
        if mp3_bytes:
            return mp3_bytes
    except Exception as e:
        print(f"MP3 conversion error (lameenc): {e}")
        return None
