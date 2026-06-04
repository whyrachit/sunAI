import pathlib


def merge_mp3_chunks(chunks: list[bytes], output_path: str | pathlib.Path) -> None:
    """Concatenate raw MP3 byte chunks into a single MP3 file.

    MP3 is a streaming frame format — direct concatenation produces a valid playable file.
    """
    output_path = pathlib.Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "wb") as f:
        for chunk in chunks:
            f.write(chunk)
