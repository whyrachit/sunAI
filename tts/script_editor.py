"""
Tutorial Script Editor — Revamped LLM and Local script processing.
"""

import re
from collections import Counter
from tts.sarvam_tts import SarvamTTS

# ── Local clean fallback regexes ──────────────────────────────────────────────

_SRT_TIMESTAMP = re.compile(
    r'\d{1,2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,\.]\d{3}'
)
_SRT_SEQUENCE = re.compile(r'^\d+\s*$', re.MULTILINE)
_HEADING = re.compile(
    r'^\s*(?:\d+[\.\d]*\s+[A-Z][^\n]{0,60}|'
    r'(?:Module|Lesson|Chapter|Section|Part|Unit)\s+\d+[^\n]*)\n',
    re.MULTILINE | re.IGNORECASE,
)
_HR = re.compile(r'^[-=*]{3,}\s*$', re.MULTILINE)
_MD_HEADER = re.compile(r'^#{1,6}\s+', re.MULTILINE)
_MULTI_BLANK = re.compile(r'\n{3,}')


def strip_srt_formatting(text: str) -> str:
    text = _SRT_TIMESTAMP.sub('', text)
    text = _SRT_SEQUENCE.sub('', text)
    text = _HEADING.sub('\n', text)
    text = _HR.sub('', text)
    text = _MD_HEADER.sub('', text)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    text = _MULTI_BLANK.sub('\n\n', text)
    return text.strip()


# ── Terminology & Punctuation ──────────────────────────────────────────────────

_REPLACEMENTS = [
    (re.compile(r'\bATC\b', re.IGNORECASE), 'sunAI'),
]


def apply_terminology_replacements(text: str) -> str:
    for pattern, replacement in _REPLACEMENTS:
        text = pattern.sub(replacement, text)
    return text


_DEVANAGARI = re.compile(r'[ऀ-ॿ]')
_ELLIPSIS_DOTS = re.compile(r'\.{3,}')
_ELLIPSIS_OVERUSE = re.compile(r'…')


def _ends_in_hindi_word(sentence: str) -> bool:
    words = re.findall(r'\S+', sentence.rstrip(' \t'))
    if not words:
        return False
    last_word = re.sub(r'[.!?।,…\s]+$', '', words[-1])
    return bool(_DEVANAGARI.search(last_word))


def fix_punctuation(text: str) -> str:
    text = _ELLIPSIS_DOTS.sub('…', text)
    paragraphs = re.split(r'\n{2,}', text)
    fixed_paras = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        ellipsis_count = len(_ELLIPSIS_OVERUSE.findall(para))
        if ellipsis_count > 2:
            replacements_done = [0]
            def _replace_excess(m):
                replacements_done[0] += 1
                return '…' if replacements_done[0] <= 2 else ','
            para = _ELLIPSIS_OVERUSE.sub(_replace_excess, para)

        sentences = re.split(r'(?<=[.!?।…])\s+', para)
        fixed_sentences = []
        for s in sentences:
            s = s.strip()
            if not s:
                continue
            core = s.rstrip('.!?।… ')
            if not core:
                fixed_sentences.append(s)
                continue
            if '!' in s:
                terminator = '!'
            elif _ends_in_hindi_word(core):
                terminator = '।'
            else:
                terminator = '.'
            fixed_sentences.append(core + terminator)

        fixed_paras.append(' '.join(fixed_sentences))

    return '\n\n'.join(fixed_paras)


# ── Repetition Warnings ────────────────────────────────────────────────────────

_HIGH_RISK = [
    "simply", "just", "click on", "now", "here", "basically",
    "navigate to", "you can see", "this allows you to", "in order to", "make sure",
]


def check_word_repetition(text: str) -> list[str]:
    warnings: list[str] = []
    text_lower = text.lower()
    sentence_count = max(1, len(re.findall(r'[.!?।]', text)))

    for phrase in _HIGH_RISK:
        count = len(re.findall(r'\b' + re.escape(phrase) + r'\b', text_lower))
        if count > max(1, sentence_count // 4):
            warnings.append(f'"{phrase}" appears {count}× — consider varying')

    sentences = re.split(r'(?<=[.!?।])\s+', text.strip())
    openers = [re.split(r'\W+', s.strip())[0].lower() for s in sentences if s.strip()]
    opener_counts = Counter(openers)
    for word, count in opener_counts.items():
        if count >= 3 and len(word) > 2:
            warnings.append(f'"{word}" starts {count} sentences — vary sentence openers')

    return warnings


def structure_for_voiceover(text: str) -> str:
    paragraphs = re.split(r'\n{2,}', text)
    result = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        sentences = re.split(r'(?<=[.!?।])\s+', para)
        new_sentences = []

        for s in sentences:
            words = s.split()
            if len(words) > 25:
                mid = len(words) // 2
                break_idx = None
                for i in range(max(0, mid - 6), min(len(words), mid + 6)):
                    if words[i].endswith(','):
                        break_idx = i + 1
                        break
                if break_idx:
                    new_sentences.append(' '.join(words[:break_idx]).rstrip(',') + '.')
                    new_sentences.append(' '.join(words[break_idx:]))
                else:
                    new_sentences.append(s)
            else:
                new_sentences.append(s)

        result.append(' '.join(new_sentences))

    return '\n\n'.join(result)


def clean_script_local(text: str) -> tuple[str, list[str]]:
    """Local cleaning fallback using traditional rule-based formatting."""
    text = strip_srt_formatting(text)
    text = apply_terminology_replacements(text)
    text = fix_punctuation(text)
    text = structure_for_voiceover(text)
    warnings = check_word_repetition(text)
    return text, warnings


# ── LLM Script Converter ───────────────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPT = """You are Maskali, a professional conversational script editor utilizing the Sarvam 105B LLM. Your task is to transform raw transcripts, machine translations, or subtitles into highly natural, conversational, and code-mixed voiceover scripts optimized for the Sarvam AI Bulbul TTS engine.

CRITICAL TRANSLATION & SCRIPT RULE:
- The user will specify a Target Language (e.g. "Punjabi / ਪੰਜਾਬੀ", "Hindi / हिन्दी", "Tamil / தமிழ்", etc.).
- If the Target Language is not English, you MUST translate/transliterate all regional/Indic words written in Roman/English characters (e.g., Romanized Punjabi "ajj da din kaafi hectic si" or "office gaya") into their native script (e.g. Gurmukhi script for Punjabi: "ਅੱਜ ਦਾ ਦਿਨ ਕਾਫ਼ੀ hectic ਸੀ").
- Do NOT leave regional words in the English/Latin alphabet. Only actual English words, slang, or technical terms (like "hectic", "lunch", "office", "meetings", "planning", "tasks", "pressure", "relax", "chill", "important", "yo", "okay") must remain in English characters.

Follow the official Sarvam AI TTS Best Practices guidelines strictly:

1. CODE-MIXING & SCRIPT RULES:
   - Mix English technical, slang, and everyday words in English script where commonly used in urban Indian speech.
   - ALWAYS write English words in English script, and regional/native language words in their native script (e.g. Hindi/Marathi in Devanagari script, Punjabi in Gurmukhi script, Tamil in Tamil script, Telugu in Telugu script, etc.).
   - TRANSLITERATION RULE (CRITICAL): Transliterated Indic input (e.g., Hinglish/Romanized regional words) degrades output quality. You MUST convert all regional/Indic language words that are written in English script into their native script according to the target language (e.g., "कैसे हो", "आपका", "दिन" for Hindi, "ਅੱਜ ਦਾ ਦਿਨ", "ਗਿਆ" for Punjabi, etc.).
   - KEEP ACTUAL ENGLISH WORDS IN ENGLISH SCRIPT: Never convert actual English words, slang, or phrases into native script. They must remain in the English/Latin alphabet.

2. PUNCTUATION FOR PAUSES:
   - Use `,` (comma) for short pauses.
   - Use `.` (full stop) for English-ending sentences, or `।` for Indic-ending sentences.
   - Use `!` for emphasis + pause.
   - Use `…` (ellipsis) sparingly for natural hesitation/trailing off mid-thought.
   - Use double line breaks between paragraphs for natural breathing pauses.

3. FILLERS & HESITATIONS:
   - Add conversational fillers (e.g., "um", "uh", "hmm", "like...", "basically...", "actually...", "you know...", "I mean...") where appropriate to sound authentic.

4. STRICT FAITHFULNESS CONSTRAINTS:
   - Do NOT add new sentences, intros, outros, or conversational filler phrases/paragraphs if they were not in the original input text.
   - ONLY clean, transliterate, and format the exact sentences and thoughts provided in the input text. Do NOT expand or hallucinate extra text.
   - If the input is extremely short, return only the polished translation/transcription of that specific text.

Output ONLY the polished narration script ready for synthesis. No explanations, no headings, no intro/outro notes."""


def _get_script_instruction(target_lang: str) -> str:
    lang = target_lang.split('/')[0].strip().lower()
    if "punjabi" in lang:
        return "Since the target language is Punjabi, you MUST convert all regional/Punjabi words written in English/Roman script (like 'ajj da din kaafi hectic si... subah office gaya te poora din meetings vich nikal gaya') into proper Gurmukhi script characters (ਗੁਰਮੁਖੀ) (e.g., 'ਅੱਜ ਦਾ ਦਿਨ ਕਾਫ਼ੀ hectic ਸੀ... ਸਵੇਰੇ office ਗਿਆ ਤੇ ਪੂਰਾ ਦਿਨ meetings ਵਿੱਚ ਨਿਕਲ ਗਿਆ'). Leave actual English words in English script."
    elif "hindi" in lang or "marathi" in lang:
        return "Since the target language is Hindi/Marathi, you MUST convert all regional/Indic words written in English/Roman script into proper Devanagari script characters (देवनागरी). Leave actual English words in English script."
    elif "tamil" in lang:
        return "Since the target language is Tamil, you MUST convert all regional/Tamil words written in English/Roman script into proper Tamil script characters (தமிழ்). Leave actual English words in English script."
    elif "telugu" in lang:
        return "Since the target language is Telugu, you MUST convert all regional/Telugu words written in English/Roman script into proper Telugu script characters (తెలుగు). Leave actual English words in English script."
    elif "kannada" in lang:
        return "Since the target language is Kannada, you MUST convert all regional/Kannada words written in English/Roman script into proper Kannada script characters (ಕನ್ನಡ). Leave actual English words in English script."
    elif "bengali" in lang:
        return "Since the target language is Bengali, you MUST convert all regional/Bengali words written in English/Roman script into proper Bengali script characters (বাংলা). Leave actual English words in English script."
    elif "gujarati" in lang:
        return "Since the target language is Gujarati, you MUST convert all regional/Gujarati words written in English/Roman script into proper Gujarati script characters (ગુજરાતી). Leave actual English words in English script."
    elif "malayalam" in lang:
        return "Since the target language is Malayalam, you MUST convert all regional/Malayalam words written in English/Roman script into proper Malayalam script characters (മലയാളം). Leave actual English words in English script."
    elif "odia" in lang:
        return "Since the target language is Odia, you MUST convert all regional/Odia words written in English/Roman script into proper Odia script characters (ଓଡ଼ିଆ). Leave actual English words in English script."
    return ""


def clean_script_llm(
    api_key: str,
    text: str,
    target_lang: str,
    custom_prompt: str = None,
    workspace: str = "Default Workspace",
    user: str = "ATC",
    feature: str = "Script Polishing"
) -> tuple[str, list[str]]:
    """
    Format the script using the Sarvam 105B LLM.
    Returns (cleaned_text, warnings).
    """
    tts = SarvamTTS(api_key)
    
    system_prompt = custom_prompt if custom_prompt else DEFAULT_SYSTEM_PROMPT
    script_inst = _get_script_instruction(target_lang)
    user_prompt = f"Target Language for formatting: {target_lang}\n{script_inst}\n\nHere is the raw script to optimize:\n\n{text}"
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        cleaned_text = tts.run_chat_completion(
            messages,
            feature=feature if not target_lang else f"{feature} ({target_lang})",
            user=user,
            workspace=workspace
        )
        # Still generate warnings locally to give user quality insights
        warnings = check_word_repetition(cleaned_text)
        return cleaned_text.strip(), warnings
    except Exception as e:
        # Fall back to local clean
        cleaned_text, warnings = clean_script_local(text)
        warnings.append(f"LLM conversion failed (using local cleaning fallback): {e}")
        return cleaned_text, warnings


# ── LLM SRT Parser & Preserver ─────────────────────────────────────────────────

DEFAULT_SRT_SYSTEM_PROMPT = """You are Maskali, a professional Subtitle Script Editor utilizing the Sarvam 105B LLM. Your task is to clean up, localize, and format a list of numbered subtitle lines.

CRITICAL TRANSLATION & SCRIPT RULE:
- The user will specify a Target Language (e.g. "Punjabi / ਪੰਜਾਬੀ", "Hindi / हिन्दी", "Tamil / தமிழ்", etc.).
- If the Target Language is not English, you MUST translate/transliterate all regional/Indic words written in Roman/English characters (e.g., Romanized Punjabi "ajj da din kaafi hectic si" or "office gaya") into their native script (e.g. Gurmukhi script for Punjabi: "ਅੱਜ ਦਾ ਦਿਨ ਕਾਫ਼ੀ hectic ਸੀ").
- Do NOT leave regional words in the English/Latin alphabet. Only actual English words, slang, or technical terms (like "hectic", "lunch", "office", "meetings", "planning", "tasks", "pressure", "relax", "chill", "important", "yo", "okay") must remain in English characters.

For each numbered line (e.g. "1: text"):
1. Clean and translate the text segment, keeping it brief and matching the duration.
2. Follow the Sarvam TTS Cookbook guidelines:
   - Keep a highly natural, conversational code-mixed Hinglish tone. Do NOT over-formalize.
   - Write English words in English characters (e.g., "yo", "basically", "so yeah", "let's get started", "okay", "app", "website", "hectic", "lunch", "office", "meetings", "planning", "tasks", "pressure", "relax", "chill", "important").
   - TRANSLITERATION RULE: Convert ALL Indic/regional words that are transliterated in Roman/English characters into their respective native scripts according to the target language (e.g., Hindi/Marathi to Devanagari, Punjabi to Gurmukhi script like "ਅੱਜ ਦਾ ਦਿਨ", Tamil to Tamil script, etc.).
   - KEEP ENGLISH IN ENGLISH SCRIPT: Keep actual English words, English slang, and English phrases in the English/Latin alphabet. Do NOT convert English words into native scripts (e.g., "yo yo yo kaise ho" should output "yo yo yo कैसे हो").
   - Use `,` (comma) for short pauses, `.` or `।` for sentence ends, and `…` for hesitation.
3. Sentence endings:
   - If the segment ends in a Hindi/Indic word, end with `।`.
   - If it ends in an English word, end with `.`.
4. Avoid repetitive words across consecutive blocks.
5. STRICT FAITHFULNESS CONSTRAINTS:
   - Do NOT add new sentences, intros, outros, or extra conversational dialog segment items.
   - Clean, correct, translate, and format ONLY the exact words/ideas that exist inside each input line. Do NOT expand or hallucinate extra text.

Output the results using the EXACT same numbering format, like:
1: [Polished text]
2: [Polished text]

Do NOT merge lines, do NOT omit any lines, and do NOT add any conversational explanation. Return ONLY the numbered lines."""


def clean_srt_llm(
    api_key: str,
    srt_content: str,
    target_lang: str,
    custom_prompt: str = None,
    workspace: str = "Default Workspace",
    user: str = "ATC",
    feature: str = "Script Polishing"
) -> tuple[str, list[str]]:
    """
    Cleans SRT subtitle entries using the Sarvam 105B LLM while keeping the original
    srt sequence and timestamps intact.
    """
    # 1. Parse original SRT structure
    blocks = []
    lines = srt_content.replace('\r\n', '\n').replace('\r', '\n').splitlines()
    
    current_block = {"index": None, "timestamps": None, "text_lines": []}
    
    # Simple SRT parse state machine
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_block["index"] is not None:
                blocks.append(current_block)
                current_block = {"index": None, "timestamps": None, "text_lines": []}
            continue
            
        if current_block["index"] is None and stripped.isdigit():
            current_block["index"] = int(stripped)
        elif current_block["timestamps"] is None and "-->" in stripped:
            current_block["timestamps"] = stripped
        else:
            current_block["text_lines"].append(line)
            
    if current_block["index"] is not None:
        blocks.append(current_block)
        
    if not blocks:
        return srt_content, ["Could not parse any valid SRT blocks."]
        
    # 2. Format texts into numbered lines for the LLM
    numbered_input = []
    for idx, b in enumerate(blocks):
        original_text = " ".join(b["text_lines"]).strip()
        numbered_input.append(f"{idx + 1}: {original_text}")
        
    script_inst = _get_script_instruction(target_lang)
    user_prompt = f"Target Language for formatting: {target_lang}\n{script_inst}\n\nHere are the numbered subtitle lines:\n\n" + "\n".join(numbered_input)
    
    system_prompt = custom_prompt if custom_prompt else DEFAULT_SRT_SYSTEM_PROMPT
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        tts = SarvamTTS(api_key)
        response = tts.run_chat_completion(
            messages,
            feature=feature if not target_lang else f"{feature} ({target_lang})",
            user=user,
            workspace=workspace
        )
        
        # 3. Parse LLM response line-by-line
        cleaned_map = {}
        pattern = re.compile(r'^(\d+)\s*:\s*(.*)$')
        
        for line in response.splitlines():
            match = pattern.match(line.strip())
            if match:
                num = int(match.group(1))
                text = match.group(2).strip()
                cleaned_map[num] = text
                
        # Reconstruct the SRT content
        reconstructed = []
        warnings = []
        
        for i, b in enumerate(blocks):
            num = i + 1
            cleaned_text = cleaned_map.get(num)
            
            if cleaned_text is None:
                # Fallback to local cleaning of the original text
                original_text = " ".join(b["text_lines"])
                cleaned_text = apply_terminology_replacements(original_text)
                cleaned_text = fix_punctuation(cleaned_text)
                warnings.append(f"Block {b['index']} was omitted by LLM; used local clean fallback.")
                
            reconstructed.append(str(b["index"]))
            reconstructed.append(b["timestamps"])
            reconstructed.append(cleaned_text)
            reconstructed.append("") # Blank line separator
            
        full_srt = "\n".join(reconstructed)
        
        # General repetition warning check
        repetition_warnings = check_word_repetition(full_srt)
        warnings.extend(repetition_warnings)
        
        return full_srt, warnings
        
    except Exception as e:
        # Complete fallback
        cleaned_srt_lines = []
        warnings = [f"LLM SRT conversion failed (using local clean fallback): {e}"]
        
        for b in blocks:
            original_text = " ".join(b["text_lines"])
            cleaned_text = apply_terminology_replacements(original_text)
            cleaned_text = fix_punctuation(cleaned_text)
            cleaned_srt_lines.append(str(b["index"]))
            cleaned_srt_lines.append(b["timestamps"])
            cleaned_srt_lines.append(cleaned_text)
            cleaned_srt_lines.append("")
            
        return "\n".join(cleaned_srt_lines), warnings
