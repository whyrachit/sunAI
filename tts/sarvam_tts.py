import base64
import io
import json
from typing import Iterator

from sarvamai import SarvamAI

DEFAULT_MODEL = "bulbul:v3"
DEFAULT_SAMPLE_RATE = 24000


class SarvamTTSError(Exception):
    def __init__(self, message: str, code: str = "", request_id: str = ""):
        super().__init__(message)
        self.code = code
        self.request_id = request_id


class SarvamTTS:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._client = SarvamAI(api_subscription_key=api_key)

    def convert(
        self,
        text: str,
        language_code: str,
        speaker: str = "mani",
        pace: float = 0.9,
        temperature: float = 0.6,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        output_audio_codec: str = "wav",
        dict_id: str | None = None,
        model: str = DEFAULT_MODEL,
        pitch: float = 0.0,
        feature: str = "TTS Conversion",
        user: str = "ATC",
        workspace: str = "Default Workspace"
    ) -> bytes:


        import requests
        url = "https://api.sarvam.ai/text-to-speech"
        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "target_language_code": language_code,
            "model": model,
            "speaker": speaker,
            "pace": pace,
            "temperature": temperature,
            "speech_sample_rate": sample_rate,
            "output_audio_codec": output_audio_codec,
        }
        if model == "bulbul:v2":
            payload["pitch"] = pitch
        if dict_id:
            payload["dict_id"] = dict_id
        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            combined = "".join(data["audios"])
            
            try:
                from tts.usage_logger import log_tts
                log_tts(
                    model=model,
                    characters=len(text),
                    speaker=speaker,
                    language=language_code,
                    feature=feature,
                    user=user,
                    workspace=workspace
                )
            except Exception:
                pass

            return base64.b64decode(combined)
        except Exception as e:
            raise SarvamTTSError(str(e)) from e

    def convert_stream(
        self,
        text: str,
        language_code: str,
        speaker: str = "mani",
        pace: float = 0.9,
        temperature: float = 0.6,
        output_audio_codec: str = "mp3",
        dict_id: str | None = None,
        model: str = DEFAULT_MODEL,
        pitch: float = 0.0,
        feature: str = "TTS Stream",
        user: str = "ATC",
        workspace: str = "Default Workspace"
    ) -> Iterator[bytes]:


        import requests
        url = "https://api.sarvam.ai/text-to-speech/stream"
        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "text": text,
            "target_language_code": language_code,
            "model": model,
            "speaker": speaker,
            "pace": pace,
            "temperature": temperature,
            "output_audio_codec": output_audio_codec,
        }
        if model == "bulbul:v2":
            payload["pitch"] = pitch
        if dict_id:
            payload["dict_id"] = dict_id
        try:
            response = requests.post(url, headers=headers, json=payload, stream=True)
            response.raise_for_status()
            
            # Log stream conversion
            try:
                from tts.usage_logger import log_tts
                log_tts(
                    model=model,
                    characters=len(text),
                    speaker=speaker,
                    language=language_code,
                    feature=feature,
                    user=user,
                    workspace=workspace
                )
            except Exception:
                pass

            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    yield chunk
        except Exception as e:
            raise SarvamTTSError(str(e)) from e

    def create_pronunciation_dict(self, pronunciations: dict) -> str:
        import requests
        url = "https://api.sarvam.ai/text-to-speech/pronunciation-dictionary"
        headers = {
            "api-subscription-key": self.api_key
        }
        payload = json.dumps({"pronunciations": pronunciations})
        files = {
            "file": ("pronunciations.json", payload, "application/json")
        }
        response = requests.post(url, headers=headers, files=files)
        response.raise_for_status()
        data = response.json()
        return data.get("dictionary_id") or data.get("id") or data.get("dict_id")

    def list_pronunciation_dicts(self) -> list:
        import requests
        url = "https://api.sarvam.ai/text-to-speech/pronunciation-dictionary"
        headers = {
            "api-subscription-key": self.api_key
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        result = response.json()
        if isinstance(result, dict) and "dictionaries" in result:
            return result["dictionaries"] or []
        if isinstance(result, list):
            return result
        return []

    def get_pronunciation_dict(self, dict_id: str):
        import requests
        url = f"https://api.sarvam.ai/text-to-speech/pronunciation-dictionary/{dict_id}"
        headers = {
            "api-subscription-key": self.api_key
        }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()

    def delete_pronunciation_dict(self, dict_id: str) -> None:
        import requests
        url = f"https://api.sarvam.ai/text-to-speech/pronunciation-dictionary/{dict_id}"
        headers = {
            "api-subscription-key": self.api_key
        }
        response = requests.delete(url, headers=headers)
        response.raise_for_status()

    def run_chat_completion(self, messages: list, model: str = "sarvam-105b", feature: str = "LLM Script Processing", user: str = "ATC", workspace: str = "Default Workspace") -> str:
        """Call the Sarvam AI Chat Completions API using the sarvam-105b model."""


        import requests
        url = "https://api.sarvam.ai/v1/chat/completions"
        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.01
        }
        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            try:
                from tts.usage_logger import log_llm
                prompt_chars = sum(len(msg.get("content", "")) for msg in messages)
                prompt_tokens = prompt_chars // 4
                completion_tokens = len(content) // 4
                log_llm(
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    feature=feature,
                    user=user,
                    workspace=workspace
                )
            except Exception:
                pass
                
            return content
        except Exception as e:
            raise SarvamTTSError(f"Chat completion failed: {e}")
