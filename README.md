# 🕊️ sunAI Studio

```text
                           .-''-.
                          / ,    \
                       .-'`(o)    ;
                      '-==.       |
                           `._...-;-.
                            )--"""   `-.
                           /   .        `-.
                          /   /      `.    `-.
                          |   \    ;   \      `-._________
                          |    \    `.`.;          -------`.
                           \    `-.   \\\\          `---...|
                            `.     `-. ```\.--'._   `---...|
                              `-.....7`-.))\     `-._`-.. /
                                `._\ /   `-`         `-.,'
                                  / /
                                 /=(_    ✉️ [LETTER]
                              -./--' `  /
                             _,^-(_____'
                            / ,--' `     \
                           /              \
     ====================='================'=====================
     ||===|===|===|===|===|===|===|===|===|===|===|===|===|===||
     ||   |   |   |   |   |   |   |   |   |   |   |   |   |   ||
     ||___|___|___|___|___|___|___|___|___|___|___|___|___|___||
     [=========================================================]
```

Once upon a time in ancient courtyards, there was a legendary messenger pigeon named **Maskali**. Long before text messages, emails, or high-speed data networks, Maskali flew across vast kingdoms, scaling mountain peaks and crossing oceans to deliver hand-written scroll messages from balcony to balcony. 

Today, **sunAI Studio** brings the spirit of Maskali back to life. Instead of leaving your text scripts silent, we hand them to Maskali, who gives them a clean, natural voice and delivers them beautifully to your audience.

Welcome to your personal, premium voiceover workstation! 

---

## 🎭 The Studio Experience

### 1. 🧹 Script Polishing (The Nest)
Have raw transcriptions, messy subtitles, or notes written in code-mixed languages? Hand them over! Maskali uses the **Sarvam-105B LLM** to clean up the formatting, translate Romanized regional words into native script (Devanagari, Gurmukhi, Telugu, Tamil, etc.), and ensure standard English words (`office`, `meetings`, `lunch`) remain in English so they sound natural when spoken.

### 2. 🎙️ Voice Converter (The Songbird)
Choose your messenger! Select from premium male and female voices and dial in your delivery style:
* **Explainer**: Measured and clear for instructions.
* **Conversational**: Relaxed, conversational walkthrough tone.
* **Storytelling**: Warm, expressive narrations.

### 3. 🎚️ Retro Vinyl Record Player
Once Maskali synthesizes your track, spin it on our custom retro record player! Watch the tonearm drop onto the record, watch the deck pulse to the rhythm, and see green sonic ripples wave outwards from the edge of the record as it spins.

### 4. 📖 Pronunciation Dictionary (The Lexicon)
Teach Maskali new vocabulary! If you have specific brand names, acronyms, or unique words, map them to their exact phonetic guides so they are spoken perfectly every single time. You can import and export your word banks as JSON files to share them.

### 5. 📊 API Usage & Spend Analytics
Track exactly how much characters, tokens, and INR currency Maskali is using. Export your logs to CSV whenever you want to analyze your usage.

---

## 🛠️ Launching the Studio

### 1. Feed the Pigeon (Install Dependencies)
Open your terminal and run:
```bash
# Setup backend dependencies
cd backend
pip install -r requirements.txt

# Setup frontend dependencies
cd ../frontend
npm install
```

### 2. Take Flight (Run Locally)

1. **Start the Nest (Backend API)**:
   ```bash
   cd backend
   uvicorn server:app --reload --port 8000
   ```

2. **Open the Studio gates (Frontend)**:
   ```bash
   cd frontend
   npm run dev
   ```

Open `http://localhost:5173` in your browser, log in with your API Key, and let Maskali take flight!

### 3. Using the CLI scripts
You can run the script tools directly from the `backend` environment:
```bash
# Convert a file directly to audio
python backend/scripts/convert.py lecture.txt -l en -o output.mp3

# Manage pronunciation dictionary
python backend/scripts/manage_dict.py list
```

---

*Made with 🕊️ and code-mixed love. Coo coo!*
