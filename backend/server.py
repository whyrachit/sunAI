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



# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/login")
async def api_login(req: LoginRequest):
    """
    Validate the Username and Sarvam API key.
    Checks connectivity against Sarvam's listing endpoints.
    """
    if not req.username.strip() or not req.apiKey.strip():
        raise HTTPException(status_code=400, detail="Username and API key are required.")

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
    
    # Check if the content is in SRT formatting
    is_srt = req.filename.lower().endswith(".srt") or req.text.strip().startswith("1\n00:")
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
    is_srt = req.filename.lower().endswith(".srt") or cleaned.strip().startswith("1\n00:")

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
    entries = [e.dict() for e in req.entries]
    if not entries:
        raise HTTPException(status_code=400, detail="No pronunciation dictionary entries found to upload.")
    
    pronunciations = _entries_to_sarvam_format(entries)
    tts = SarvamTTS(req.apiKey)
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


