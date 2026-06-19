import base64
import io
import json
import os
import pathlib
import sys
import zipfile
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Ensure parent (root) and backend directories are in the sys path for local imports
backend_dir = pathlib.Path(__file__).parent.resolve()
root_dir = backend_dir.parent.resolve()
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from tts.sarvam_tts import SarvamTTS, SarvamTTSError
from tts.script_editor import clean_script_llm, clean_srt_llm
from tts.pause_processor import (
    split_into_pause_segments, generate_silence_wav,
    concatenate_wavs, try_wav_to_mp3,
)
from tts.chunker import chunk_text
from tts.document_parser import parse_document
from tts.usage_logger import log_tts, log_llm, log_translation, get_logs
import tempfile

load_dotenv()

app = FastAPI(title="sunAI API Server", version="1.0.0")

# Enable CORS for React frontend communications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow Vite hot-reloading domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Dictionary Helpers ────────────────────────────────────────────────────────

def _entries_to_sarvam_format(entries: list[dict]) -> dict:
    result: dict[str, dict] = {}
    for e in entries:
        lang = e.get("language", "en-IN")
        word = str(e.get("word", "")).strip()
        pron = str(e.get("pronunciation", "")).strip()
        if word and pron:
            result.setdefault(lang, {})[word] = pron
    return result


def _sarvam_format_to_entries(pronunciations: dict) -> list[dict]:
    """Inverse of _entries_to_sarvam_format: {lang: {word: pron}} -> flat entries."""
    entries: list[dict] = []
    for lang, words in (pronunciations or {}).items():
        if not isinstance(words, dict):
            continue
        for word, pron in words.items():
            entries.append({"language": lang, "word": word, "pronunciation": pron})
    return entries


def _dict_id_of(item) -> Optional[str]:
    """list_pronunciation_dicts may return bare id strings or objects."""
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        return item.get("dictionary_id") or item.get("id") or item.get("dict_id")
    return None


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    apiKey: str


class ScriptCleanRequest(BaseModel):
    apiKey: str
    text: str
    targetLang: str
    preserveSrt: bool
    customPrompt: Optional[str] = None
    workspace: Optional[str] = "Default Workspace"


class SpeechRequest(BaseModel):
    apiKey: str
    text: str
    filename: str
    langCode: str
    speakers: List[str] # List of speaker display names (e.g. "Male - Shubh (Recommended)")
    pace: float
    temperature: float
    sampleRate: int
    paraPauseMs: int
    wantMp3: bool
    model: Optional[str] = "bulbul:v3"
    pitch: Optional[float] = 0.0
    workspace: Optional[str] = "Default Workspace"
    dictId: Optional[str] = None


class PipelineRequest(BaseModel):
    apiKey: str
    text: str
    filename: str
    langCode: str
    speakers: List[str]
    pace: float
    temperature: float
    sampleRate: int
    paraPauseMs: int
    preserveSrt: bool
    wantMp3: bool
    customPrompt: Optional[str] = None
    model: Optional[str] = "bulbul:v3"
    pitch: Optional[float] = 0.0
    workspace: Optional[str] = "Default Workspace"
    dictId: Optional[str] = None


class DictionaryEntry(BaseModel):
    language: str
    word: str
    pronunciation: str


class DictionarySaveRequest(BaseModel):
    entries: List[DictionaryEntry]
    workspace: Optional[str] = "Default Workspace"


class UpdateDictIdRequest(BaseModel):
    sarvam_dict_id: Optional[str] = None
    workspace: Optional[str] = "Default Workspace"


class DictionaryUploadRequest(BaseModel):
    apiKey: str
    entries: List[DictionaryEntry]
    workspace: Optional[str] = "Default Workspace"
    oldDictId: Optional[str] = None


class DictionaryLoadRequest(BaseModel):
    apiKey: str
    workspace: Optional[str] = "Default Workspace"



# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/login")
async def api_login(req: LoginRequest):
    """
    Validate the Username and Sarvam API key.
    Checks connectivity against Sarvam's listing endpoints.
    """
    if not req.username.strip() or not req.apiKey.strip():
        raise HTTPException(status_code=400, detail="Username and API key are required.")

    # Support dummy API key for demo experience
    if req.apiKey.strip() == "sk_demo_only":
        return {"success": True, "message": "Demo login validated successfully."}

    # Validate against Sarvam endpoint by listing dicts (acts as a credentials verify ping)
    tts = SarvamTTS(req.apiKey)
    try:
        tts.list_pronunciation_dicts()
        return {"success": True, "message": "Login validated successfully."}

    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: Invalid API key. ({e})")


@app.post("/api/clean-script")
async def api_clean_script(req: ScriptCleanRequest):
    """Clean and polish script/SRT file using Sarvam 105B LLM."""
    if req.apiKey.strip() == "sk_demo_only":
        raise HTTPException(
            status_code=403,
            detail="Demo Mode: Script cleaning is disabled. Please configure a valid Sarvam API key to use this feature."
        )
    try:
        username = os.getenv("APP_USERNAME", "ATC")
        if req.preserveSrt:
            cleaned, warnings = clean_srt_llm(
                api_key=req.apiKey,
                srt_content=req.text,
                target_lang=req.targetLang,
                custom_prompt=req.customPrompt,
                workspace=req.workspace or "Default Workspace",
                user=username
            )
        else:
            cleaned, warnings = clean_script_llm(
                api_key=req.apiKey,
                text=req.text,
                target_lang=req.targetLang,
                custom_prompt=req.customPrompt,
                workspace=req.workspace or "Default Workspace",
                user=username
            )
        
        # Calculate usage
        prompt_tokens = (len(req.text) + 2000) // 4
        completion_tokens = len(cleaned) // 4
        usage = log_llm(
            model="sarvam-105b",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            feature="Script Polishing",
            user=username,
            workspace=req.workspace or "Default Workspace"
        )
        
        return {"success": True, "cleaned": cleaned, "warnings": warnings, "usage": usage}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/convert-speech")
async def api_convert_speech(req: SpeechRequest):
    """Convert text script chunk-by-chunk to high-fidelity audio tracks."""
    if req.apiKey.strip() == "sk_demo_only":
        raise HTTPException(
            status_code=403,
            detail="Demo Mode: Voice generation is disabled. Please configure a valid Sarvam API key to use this feature."
        )
    dict_id = req.dictId

    # Resolve speaker codes from labels
    # VOICES map: label -> speaker code
    VOICES_MAP = {
        "Male - Shubh (Recommended)": "shubh",
        "Male - Aditya": "aditya",
        "Male - Dev": "dev",
        "Male - Kabir": "kabir",
        "Male - Mani": "mani",
        "Male - Rohan": "rohan",
        "Male - Rahul": "rahul",
        "Male - Amit": "amit",
        "Male - Ratan": "ratan",
        "Male - Varun": "varun",
        "Male - Manan": "manan",
        "Male - Sumit": "sumit",
        "Male - Aayan": "aayan",
        "Male - Ashutosh": "ashutosh",
        "Male - Advait": "advait",
        "Male - Anand": "anand",
        "Male - Tarun": "tarun",
        "Male - Sunny": "sunny",
        "Male - Gokul": "gokul",
        "Male - Vijay": "vijay",
        "Male - Mohit": "mohit",
        "Female - Ritu (Recommended)": "ritu",
        "Female - Priya": "priya",
        "Female - Neha": "neha",
        "Female - Pooja": "pooja",
        "Female - Kavya": "kavya",
        "Female - Ishita": "ishita",
        "Female - Tanya": "tanya",
        "Female - Simran": "simran",
        "Female - Shreya": "shreya",
        "Female - Roopa": "roopa",
        "Female - Amelia": "amelia",
        "Female - Sophia": "sophia",
        "Female - Shruti": "shruti",
        "Female - Suhani": "suhani",
        "Female - Kavitha": "kavitha",
    }

    results = {}

    # Detect SRT by CONTENT, not filename. A .srt uploaded via /api/parse-file has
    # already had its timestamps stripped, so a filename check would wrongly route
    # plain text through the SRT parser (which then finds no timestamps and yields
    # zero segments → "empty script" error). Content detection is correct for both
    # stripped uploads (treated as plain text) and raw pasted SRT.
    from tts.srt_parser import looks_like_srt
    is_srt = looks_like_srt(req.text)
    username = os.getenv("APP_USERNAME", "ATC")
    
    for speaker_label in req.speakers:
        spk_code = VOICES_MAP.get(speaker_label, "shubh")
        
        try:
            # Re-evaluate audio layer concatenation directly here
            if is_srt:
                from tts.srt_parser import parse_srt_to_segments
                segments = parse_srt_to_segments(req.text)
            elif req.paraPauseMs > 0:
                segments = split_into_pause_segments(req.text, max_chunk_chars=2400, paragraph_pause_ms=req.paraPauseMs)
            else:
                segments = [(c, 0) for c in chunk_text(req.text, 2400)]

            if not segments:
                raise ValueError("Parsed script segments are empty.")

            tts = SarvamTTS(req.apiKey)
            wav_pieces = []

            for seg_text, pause_ms in segments:
                wav = tts.convert(
                    text=seg_text, language_code=req.langCode, speaker=spk_code,
                    pace=req.pace, temperature=req.temperature, sample_rate=req.sampleRate,
                    output_audio_codec="wav", dict_id=dict_id,
                    model=req.model, pitch=req.pitch,
                    feature="TTS Preview" if req.filename == "preview.txt" else "TTS Document",
                    user=username,
                    workspace=req.workspace or "Default Workspace"
                )
                wav_pieces.append(wav)
                if pause_ms > 0:
                    wav_pieces.append(generate_silence_wav(pause_ms, sample_rate=req.sampleRate))

            merged = concatenate_wavs(wav_pieces)
            ext = "wav"

            if req.wantMp3:
                mp3 = try_wav_to_mp3(merged)
                if mp3:
                    merged = mp3
                    ext = "mp3"

            results[speaker_label] = {
                "filename": f"{pathlib.Path(req.filename).stem}_{spk_code}.{ext}",
                "data": base64.b64encode(merged).decode("utf-8"),
                "ext": ext,
                "size_kb": len(merged) / 1024
            }
        except Exception as e:
            results[speaker_label] = {"error": f"Synthesis error: {e}"}

    # Compute usage details
    usages = []
    for speaker_label in req.speakers:
        if speaker_label in results and "error" not in results[speaker_label]:
            usage_item = log_tts(
                model=req.model,
                characters=len(req.text),
                speaker=speaker_label,
                language=req.langCode,
                feature="TTS Preview" if req.filename == "preview.txt" else "TTS Document",
                user=username,
                workspace=req.workspace or "Default Workspace"
            )
            usages.append(usage_item)

    return {"success": True, "audios": results, "usages": usages}



@app.post("/api/run-pipeline")
async def api_run_pipeline(req: PipelineRequest):
    """End-to-end pipeline: optimizes the raw text via LLM, then synthesizes audio for all speakers."""
    if req.apiKey.strip() == "sk_demo_only":
        raise HTTPException(
            status_code=403,
            detail="Demo Mode: Pipeline run is disabled. Please configure a valid Sarvam API key to use this feature."
        )
    username = os.getenv("APP_USERNAME", "ATC")
    # Step 1: Script optimization
    try:
        if req.preserveSrt:
            cleaned, warnings = clean_srt_llm(
                api_key=req.apiKey,
                srt_content=req.text,
                target_lang=req.langCode,
                custom_prompt=req.customPrompt,
                workspace=req.workspace or "Default Workspace",
                user=username,
                feature="Pipeline Polishing"
            )
        else:
            cleaned, warnings = clean_script_llm(
                api_key=req.apiKey,
                text=req.text,
                target_lang=req.langCode,
                custom_prompt=req.customPrompt,
                workspace=req.workspace or "Default Workspace",
                user=username,
                feature="Pipeline Polishing"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM script converting failed: {e}")

    # Step 2: Synthesis calling local convert endpoint logic
    dict_id = req.dictId

    VOICES_MAP = {
        "Male - Shubh (Recommended)": "shubh",
        "Male - Aditya": "aditya",
        "Male - Dev": "dev",
        "Male - Kabir": "kabir",
        "Male - Mani": "mani",
        "Male - Rohan": "rohan",
        "Male - Rahul": "rahul",
        "Male - Amit": "amit",
        "Male - Ratan": "ratan",
        "Male - Varun": "varun",
        "Male - Manan": "manan",
        "Male - Sumit": "sumit",
        "Male - Aayan": "aayan",
        "Male - Ashutosh": "ashutosh",
        "Male - Advait": "advait",
        "Male - Anand": "anand",
        "Male - Tarun": "tarun",
        "Male - Sunny": "sunny",
        "Male - Gokul": "gokul",
        "Male - Vijay": "vijay",
        "Male - Mohit": "mohit",
        "Female - Ritu (Recommended)": "ritu",
        "Female - Priya": "priya",
        "Female - Neha": "neha",
        "Female - Pooja": "pooja",
        "Female - Kavya": "kavya",
        "Female - Ishita": "ishita",
        "Female - Tanya": "tanya",
        "Female - Simran": "simran",
        "Female - Shreya": "shreya",
        "Female - Roopa": "roopa",
        "Female - Amelia": "amelia",
        "Female - Sophia": "sophia",
        "Female - Shruti": "shruti",
        "Female - Suhani": "suhani",
        "Female - Kavitha": "kavitha",
    }

    results = {}
    from tts.srt_parser import looks_like_srt
    is_srt = looks_like_srt(cleaned)

    for speaker_label in req.speakers:
        spk_code = VOICES_MAP.get(speaker_label, "shubh")
        
        try:
            if is_srt:
                from tts.srt_parser import parse_srt_to_segments
                segments = parse_srt_to_segments(cleaned)
            elif req.paraPauseMs > 0:
                segments = split_into_pause_segments(cleaned, max_chunk_chars=2400, paragraph_pause_ms=req.paraPauseMs)
            else:
                segments = [(c, 0) for c in chunk_text(cleaned, 2400)]

            tts = SarvamTTS(req.apiKey)
            wav_pieces = []

            for seg_text, pause_ms in segments:
                wav = tts.convert(
                    text=seg_text, language_code=req.langCode, speaker=spk_code,
                    pace=req.pace, temperature=req.temperature, sample_rate=req.sampleRate,
                    output_audio_codec="wav", dict_id=dict_id,
                    model=req.model, pitch=req.pitch,
                    feature="TTS Document (Pipeline)",
                    user=username,
                    workspace=req.workspace or "Default Workspace"
                )
                wav_pieces.append(wav)
                if pause_ms > 0:
                    wav_pieces.append(generate_silence_wav(pause_ms, sample_rate=req.sampleRate))

            merged = concatenate_wavs(wav_pieces)
            ext = "wav"

            if req.wantMp3:
                mp3 = try_wav_to_mp3(merged)
                if mp3:
                    merged = mp3
                    ext = "mp3"

            results[speaker_label] = {
                "filename": f"{pathlib.Path(req.filename).stem}_{spk_code}.{ext}",
                "data": base64.b64encode(merged).decode("utf-8"),
                "ext": ext,
                "size_kb": len(merged) / 1024
            }
        except Exception as e:
            results[speaker_label] = {"error": f"Synthesis error: {e}"}

    # Calculate usages
    usages = []
    # 1. LLM usage
    prompt_tokens = (len(req.text) + 2000) // 4
    completion_tokens = len(cleaned) // 4
    llm_usage = log_llm(
        model="sarvam-105b",
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        feature="Pipeline Polishing",
        user=username,
        workspace=req.workspace or "Default Workspace"
    )
    usages.append(llm_usage)

    # 2. TTS usages
    for speaker_label in req.speakers:
        if speaker_label in results and "error" not in results[speaker_label]:
            usage_item = log_tts(
                model=req.model,
                characters=len(cleaned),
                speaker=speaker_label,
                language=req.langCode,
                feature="TTS Document (Pipeline)",
                user=username,
                workspace=req.workspace or "Default Workspace"
            )
            usages.append(usage_item)

    return {
        "success": True,
        "cleaned": cleaned,
        "warnings": warnings,
        "audios": results,
        "usages": usages
    }


@app.get("/api/dictionary")
async def api_get_dictionary(workspace: Optional[str] = None):
    """Retrieve local dictionary entries and active cloud IDs (Stateless Mock)."""
    return {"entries": [], "sarvam_dict_id": None, "last_synced": None}


@app.post("/api/dictionary/load")
async def api_load_dictionary(req: DictionaryLoadRequest):
    """Load the shared pronunciation dictionary for this API key from the Sarvam
    cloud. Because Sarvam stores dictionaries per API key, every user on the same
    key sees the same entries (one shared dict per key). Falls back gracefully if
    the key is the demo placeholder."""
    if req.apiKey.strip() == "sk_demo_only":
        return {"success": True, "entries": [], "dictionary_id": None}

    tts = SarvamTTS(req.apiKey)
    try:
        items = tts.list_pronunciation_dicts()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load cloud dictionary: {e}")

    # Merge every dict on the key into one entry set (normally there is exactly
    # one; merging makes legacy multi-dict accounts converge without data loss).
    merged: dict[str, dict] = {}
    canonical_id = None
    for item in items:
        dict_id = _dict_id_of(item)
        if not dict_id:
            continue
        canonical_id = dict_id
        try:
            data = tts.get_pronunciation_dict(dict_id)
            prons = data.get("pronunciations", {}) if isinstance(data, dict) else {}
            for lang, words in (prons or {}).items():
                if isinstance(words, dict):
                    merged.setdefault(lang, {}).update(words)
        except Exception:
            continue

    return {
        "success": True,
        "entries": _sarvam_format_to_entries(merged),
        "dictionary_id": canonical_id,
    }


@app.post("/api/dictionary/save")
async def api_save_dictionary(req: DictionarySaveRequest):
    """Save dictionary entries (Stateless Mock)."""
    return {"success": True, "message": "Stateless mock: dictionary saved client-side."}


@app.post("/api/dictionary/update-id")
async def api_update_dict_id(req: UpdateDictIdRequest):
    """Update the Sarvam pronunciation dictionary ID (Stateless Mock)."""
    return {"success": True, "sarvam_dict_id": req.sarvam_dict_id}


@app.post("/api/dictionary/upload")
async def api_upload_dictionary(req: DictionaryUploadRequest):
    """Upload saved pronunciation dictionary entries to the Sarvam AI cloud (Stateless)."""
    if req.apiKey.strip() == "sk_demo_only":
        raise HTTPException(
            status_code=403,
            detail="Demo Mode: Dictionary upload to Sarvam Cloud is disabled. Please configure a valid Sarvam API key."
        )
    entries = [e.dict() for e in req.entries]
    if not entries:
        raise HTTPException(status_code=400, detail="No pronunciation dictionary entries found to upload.")
    
    pronunciations = _entries_to_sarvam_format(entries)
    tts = SarvamTTS(req.apiKey)

    # One shared dictionary per API key. Delete every existing dict on the key,
    # then create a single canonical one. This (a) keeps everyone on the key in
    # sync, and (b) prevents the per-account cap from filling up — which it did
    # previously because each upload created a brand-new dict. Deleting all
    # (rather than just a caller-supplied old id) is what makes this correct when
    # multiple users share the key: whoever uploads last leaves exactly one dict.
    try:
        for item in tts.list_pronunciation_dicts():
            existing_id = _dict_id_of(item)
            if existing_id:
                try:
                    tts.delete_pronunciation_dict(existing_id)
                except Exception:
                    pass
    except Exception:
        pass

    try:
        dict_id = tts.create_pronunciation_dict(pronunciations)
        last_synced = datetime.now().strftime("%Y-%m-%d %H:%M")
        return {"success": True, "dictionary_id": dict_id, "last_synced": last_synced}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dictionary cloud upload failed: {e}")


@app.post("/api/parse-file")
async def api_parse_file(file: UploadFile = File(...)):
    """Parse uploaded document (.txt, .docx, .srt) and return text content."""
    suffix = pathlib.Path(file.filename).suffix.lower()
    if suffix not in [".txt", ".docx", ".srt"]:
        raise HTTPException(status_code=400, detail="Unsupported file format. Upload .txt, .docx, or .srt.")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = pathlib.Path(tmp.name)
        
        try:
            parsed_text = parse_document(tmp_path)
            return {"success": True, "text": parsed_text}
        finally:
            if tmp_path.exists():
                tmp_path.unlink()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")


@app.get("/api/usage")
async def api_get_usage(workspace: Optional[str] = None):
    """Fallback stub for legacy calls; logs are client-stored now."""
    return {
        "logs": [],
        "workspaces": ["Default Workspace"],
        "total_spend_inr": 0.0,
        "model_breakdown": {},
        "feature_breakdown": {}
    }


