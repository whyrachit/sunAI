import os
from datetime import datetime

def log_tts(model: str, characters: int, speaker: str, language: str, feature: str = "TTS", user: str = "ATC", workspace: str = "Default Workspace"):
    """
    Calculate TTS request cost in INR without writing to disk.
    Bulbul v3: ₹30 per 10k characters.
    Bulbul v2: ₹15 per 10k characters.
    """
    rate = 30.0 if "v3" in model else 15.0
    cost = characters * (rate / 10000.0)
    
    return {
        "timestamp": datetime.now().isoformat(),
        "user": user,
        "workspace": workspace,
        "feature": feature,
        "model": model,
        "characters": characters,
        "tokens": 0,
        "cost_inr": round(cost, 6),
        "details": f"Speaker: {speaker}, Language: {language}"
    }

def log_llm(model: str, prompt_tokens: int, completion_tokens: int, feature: str = "Script Polishing", user: str = "ATC", workspace: str = "Default Workspace"):
    """
    Calculate LLM request cost in INR without writing to disk.
    Sarvam-105B: ₹4 per 1M input tokens, ₹16 per 1M output tokens.
    """
    input_cost = prompt_tokens * (4.0 / 1000000.0)
    output_cost = completion_tokens * (16.0 / 1000000.0)
    cost = input_cost + output_cost
    
    return {
        "timestamp": datetime.now().isoformat(),
        "user": user,
        "workspace": workspace,
        "feature": feature,
        "model": model,
        "characters": 0,
        "tokens": prompt_tokens + completion_tokens,
        "cost_inr": round(cost, 6),
        "details": f"Input: {prompt_tokens} tokens, Output: {completion_tokens} tokens"
    }

def log_translation(characters: int, user: str = "ATC", workspace: str = "Default Workspace"):
    """
    Calculate Translation request cost in INR without writing to disk.
    Translation: ₹20 per 10k characters.
    """
    cost = characters * (20.0 / 10000.0)
    return {
        "timestamp": datetime.now().isoformat(),
        "user": user,
        "workspace": workspace,
        "feature": "Translation",
        "model": "sarvam-translation",
        "characters": characters,
        "tokens": 0,
        "cost_inr": round(cost, 6),
        "details": f"Characters: {characters}"
    }

def get_logs():
    """Fallback stub for legacy calls; client logs locally now."""
    return []
