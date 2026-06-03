#!/usr/bin/env python3
"""
E-Learning Document to Audio Converter
Uses Sarvam AI bulbul:v3 TTS.

Usage:
    python convert.py lecture.txt -l en -o lesson1.mp3
    python convert.py course.docx -l hi --pace 0.85 --temperature 0.4
    python convert.py script.txt -l en --stream -o output.mp3
"""

import sys
import pathlib

# Ensure the sunAI codebase directory takes priority on the python path
_sunai_dir = pathlib.Path(__file__).parent.resolve()
if str(_sunai_dir) not in sys.path:
    sys.path.insert(0, str(_sunai_dir))

import argparse
import os
from dotenv import load_dotenv

load_dotenv()

LANGUAGES = {
    "en": ("en-IN", "English"),
    "hi": ("hi-IN", "Hindi"),
    "ta": ("ta-IN", "Tamil"),
    "te": ("te-IN", "Telugu"),
    "kn": ("kn-IN", "Kannada"),
    "ml": ("ml-IN", "Malayalam"),
    "mr": ("mr-IN", "Marathi"),
    "gu": ("gu-IN", "Gujarati"),
    "pa": ("pa-IN", "Punjabi"),
    "or": ("or-IN", "Odia"),
    "bn": ("bn-IN", "Bengali"),
}

VOICES = {"male": "mani", "female": "priya"}


def main():
    parser = argparse.ArgumentParser(
        description="Convert a document (.txt / .docx / .srt) to audio using Sarvam AI bulbul:v3",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=_epilog(),
    )

    parser.add_argument("input", help="Input file (.txt, .docx, or .srt)")
    parser.add_argument("-o", "--output", help="Output file path (default: input name with .mp3)")
    parser.add_argument(
        "-l", "--language", default="en",
        choices=list(LANGUAGES.keys()), metavar="LANG",
        help=f"Language code. Options: {', '.join(LANGUAGES)} (default: en)",
    )
    parser.add_argument(
        "-v", "--voice", default="male", choices=["male", "female"],
        help="Voice gender: male (mani) or female (priya) (default: male)",
    )
    parser.add_argument(
        "-p", "--pace", type=float, default=0.9, metavar="FLOAT",
        help="Speech pace 0.5–2.0 (default: 0.9)",
    )
    parser.add_argument(
        "-t", "--temperature", type=float, default=0.6, metavar="FLOAT",
        help="Expressiveness 0.01–1.0 (default: 0.6). Higher = more natural variation",
    )
    parser.add_argument(
        "--sample-rate", type=int, default=22050,
        choices=[8000, 16000, 22050, 24000, 32000, 44100, 48000],
        help="Audio sample rate in Hz (default: 22050)",
    )
    parser.add_argument(
        "--dict-id", default=None, metavar="DICT_ID",
        help="Sarvam pronunciation dictionary ID for custom terms",
    )
    parser.add_argument(
        "--stream", action="store_true",
        help="Use HTTP streaming (faster first-byte, better for large files)",
    )
    parser.add_argument(
        "--api-key", default=None,
        help="Sarvam API key (overrides SARVAM_API_KEY env var)",
    )

    args = parser.parse_args()

    api_key = args.api_key or os.getenv("SARVAM_API_KEY")
    if not api_key:
        print("ERROR: Sarvam API key not found.")
        print("  Set SARVAM_API_KEY in .env, or pass --api-key YOUR_KEY")
        sys.exit(1)

    input_path = pathlib.Path(args.input)
    if not input_path.exists():
        print(f"ERROR: File not found: {input_path}")
        sys.exit(1)

    output_path = pathlib.Path(args.output) if args.output else input_path.with_suffix(".mp3")
    language_code, language_name = LANGUAGES[args.language]
    speaker = VOICES[args.voice]

    print(f"\n=== TTS Studio (Sarvam AI bulbul:v3) ===")
    print(f"  Input:       {input_path}")
    print(f"  Output:      {output_path}")
    print(f"  Language:    {language_name} ({language_code})")
    print(f"  Voice:       {args.voice} ({speaker})")
    print(f"  Pace:        {args.pace}  Temperature: {args.temperature}")
    if args.dict_id:
        print(f"  Dict ID:     {args.dict_id}")
    print()

    from tts.document_parser import parse_document
    from tts.chunker import chunk_text
    from tts.sarvam_tts import SarvamTTS, SarvamTTSError
    from tts.audio_merger import merge_mp3_chunks

    print("[1/4] Parsing document...")
    try:
        text = parse_document(input_path)
    except (ValueError, ImportError) as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    if not text.strip():
        print("ERROR: Document is empty.")
        sys.exit(1)
    print(f"      {len(text):,} characters extracted")

    print(f"\n[2/4] Splitting into chunks...")
    chunks = chunk_text(text)
    print(f"      {len(chunks)} chunk(s)")

    tts = SarvamTTS(api_key)
    audio_chunks: list[bytes] = []

    if args.stream:
        print(f"\n[3/4] Converting via HTTP stream...")
        for i, chunk in enumerate(chunks, 1):
            print(f"      chunk {i}/{len(chunks)} ({len(chunk)} chars)", end="\r")
            buf = b""
            try:
                for piece in tts.convert_stream(
                    text=chunk, language_code=language_code, speaker=speaker,
                    pace=args.pace, temperature=args.temperature,
                    output_audio_codec="mp3", dict_id=args.dict_id,
                ):
                    buf += piece
            except SarvamTTSError as e:
                print(f"\nERROR on chunk {i}: {e}")
                sys.exit(1)
            audio_chunks.append(buf)
    else:
        print(f"\n[3/4] Converting to speech...")
        for i, chunk in enumerate(chunks, 1):
            bar = _bar(i, len(chunks))
            print(f"      {bar} {i}/{len(chunks)} ({len(chunk)} chars)", end="\r")
            try:
                audio = tts.convert(
                    text=chunk, language_code=language_code, speaker=speaker,
                    pace=args.pace, temperature=args.temperature,
                    sample_rate=args.sample_rate, output_audio_codec="mp3",
                    dict_id=args.dict_id,
                )
            except SarvamTTSError as e:
                print(f"\nERROR on chunk {i}: {e}")
                sys.exit(1)
            audio_chunks.append(audio)

    total_kb = sum(len(a) for a in audio_chunks) / 1024
    print(f"\n      Done — {total_kb:.1f} KB total audio")

    print(f"\n[4/4] Writing {output_path}...")
    merge_mp3_chunks(audio_chunks, output_path)
    print(f"      Saved {output_path.stat().st_size / 1024:.1f} KB")
    print(f"\nDone! {output_path.resolve()}\n")


def _bar(current: int, total: int, width: int = 20) -> str:
    filled = int(width * current / total)
    return f"[{'#' * filled}{'.' * (width - filled)}]"


def _epilog() -> str:
    langs = "  ".join(f"{k}={v[1]}" for k, v in LANGUAGES.items())
    return f"""
Languages: {langs}

Examples:
  python convert.py lecture.txt -l en -o lesson.mp3
  python convert.py hindi.docx -l hi -v female --pace 0.9
  python convert.py script.srt -l en --stream --temperature 0.8
  python convert.py chapter.txt -l en --dict-id p_abc123
"""


if __name__ == "__main__":
    main()
