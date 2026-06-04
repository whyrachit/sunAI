import pathlib


def parse_document(file_path: pathlib.Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix == ".txt":
        return _parse_txt(file_path)
    elif suffix == ".docx":
        return _parse_docx(file_path)
    elif suffix == ".srt":
        return _parse_srt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}. Supported: .txt, .docx, .srt")


def _parse_txt(file_path: pathlib.Path) -> str:
    try:
        return file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return file_path.read_text(encoding="latin-1")


def _parse_srt(file_path: pathlib.Path) -> str:
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = file_path.read_text(encoding="latin-1")
    from tts.script_editor import strip_srt_formatting
    return strip_srt_formatting(content)


def _parse_docx(file_path: pathlib.Path) -> str:
    try:
        from docx import Document
    except ImportError:
        raise ImportError("python-docx required. Run: pip install python-docx")
    doc = Document(str(file_path))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)
