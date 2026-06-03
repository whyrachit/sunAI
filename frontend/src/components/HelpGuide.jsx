import React from 'react'

export default function HelpGuide() {
  const narratorSpecs = [
    {
      preset: "Tutorial / EdTech",
      pace: "0.9x",
      temp: "0.60",
      ideal: "Structured courses, coding walk-throughs, conceptual explanations",
      desc: "Delivers a slightly measured, calm and highly clear voice designed to keep student attention and increase retention."
    },
    {
      preset: "Conversational",
      pace: "1.0x",
      temp: "0.60",
      ideal: "Informal screencasts, podcasts, conversational guides, daily digests",
      desc: "Uses a natural rhythm with high emotional variations. Best suited for everyday colloquial tone."
    },
    {
      preset: "Professional / BFSI",
      pace: "1.1x",
      temp: "0.35",
      ideal: "Corporate compliance training, banking guidelines, insurance policy explanations",
      desc: "Delivers a faster, crisp, highly authoritative voice with lower temperature for extremely stable and consistent spelling delivery."
    },
    {
      preset: "Storytelling",
      pace: "0.9x",
      temp: "0.65",
      ideal: "Children stories, historical narrative recordings, script plays",
      desc: "Warm and deeply expressive voice with high temperature, allowing maximum tone modulation."
    }
  ]

  const dictionaryRules = [
    {
      rule: "Phonetic Spelling Substitutions",
      example: "Replace 'API' with 'aay-pee-aay' or 'SQL' with 'seek-wel' to guarantee spelling voice precision.",
      context: "Sarvam's spelling system resolves text based on local phonetic mappings. If an English acronym sounds wrong, register its custom pronunciation guide."
    },
    {
      rule: "Grounded Mixed Language (Hinglish/Tanglish)",
      example: "In Hindi, register 'workspace' with 'वर्कस्पेस' pronunciation guide spelling.",
      context: "When using blended speech scripts, mapping technical English terms to their exact colloquial phonetic guidelines ensures smooth bilingual flows."
    }
  ]

  return (
    <div className="space-y-8 select-none">
      
      {/* Title */}
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-[#0c0c0e]">
          Help & <span className="grad-text">User Manual</span>
        </h2>
        <p className="text-zinc-400 text-xs mt-1 font-bold uppercase tracking-wider">
          Explore specifications, narrative styles, dictionary rules, and technical guidelines
        </p>
      </div>

      {/* Intro Card */}
      <div className="premium-card relative overflow-hidden">
        {/* Decorative Lotus Mandala SVG replaced with Geometric Brutalist Lines */}
        <div className="absolute right-0 bottom-0 opacity-[0.05] pointer-events-none select-none">
          <svg className="w-64 h-64" viewBox="0 0 100 100" fill="none" stroke="#000000" strokeWidth="1">
            <line x1="0" y1="0" x2="100" y2="100" />
            <line x1="10" y1="0" x2="100" y2="90" />
            <line x1="20" y1="0" x2="100" y2="80" />
            <line x1="30" y1="0" x2="100" y2="70" />
            <line x1="40" y1="0" x2="100" y2="60" />
            <line x1="50" y1="0" x2="100" y2="50" />
          </svg>
        </div>

        <h3 className="text-sm font-bold text-[#0c0c0e] uppercase tracking-wider mb-3">Welcome to sunAI</h3>
        <p className="text-xs text-zinc-500 max-w-3xl leading-relaxed uppercase tracking-wide font-medium">
          sunAI is a modern, high-fidelity AI-driven Voice Narration Suite built for modern eLearning content pipelines. Grounded in advanced linguistic technology, it uses the <strong>Sarvam-105B Large Language Model</strong> to clean transcripts, format scripts, and instantly generate studio-grade multilingual voice tracks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Narrative Styles Specification */}
        <div className="lg:col-span-7 space-y-6">
          <div className="premium-card">
            <h3 className="text-sm font-bold text-black mb-6 border-b border-[#1a1a1d] pb-4 uppercase tracking-wider">
              Narrative Preset Specifications
            </h3>

            <div className="space-y-6">
              {narratorSpecs.map((spec, index) => (
                <div key={index} className="bg-white border border-black p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#0c0c0e] uppercase tracking-wider">{spec.preset}</span>
                    <div className="flex gap-2">
                      <span className="geo-badge">Pace: {spec.pace}</span>
                      <span className="geo-badge">Temp: {spec.temp}</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mb-2 leading-relaxed uppercase tracking-wider font-semibold">{spec.desc}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <span className="text-black">Ideal for:</span> {spec.ideal}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dictionary Rules & Troubleshooting */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Dictionary Guidelines */}
          <div className="premium-card">
            <h3 className="text-sm font-bold text-black mb-6 border-b border-[#1a1a1d] pb-4 uppercase tracking-wider">
              Pronunciation Rules Guide
            </h3>

            <div className="space-y-6">
              {dictionaryRules.map((rule, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className="text-[10px] font-bold text-[#0c0c0e] uppercase tracking-widest">{rule.rule}</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed uppercase tracking-wider font-semibold">{rule.context}</p>
                  <div className="bg-zinc-50 border border-black p-3 text-[10px] font-mono uppercase tracking-wider leading-relaxed">
                    <span className="text-zinc-400">Example:</span> {rule.example}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Support Troubleshooting */}
          <div className="premium-card">
            <h3 className="text-sm font-bold text-black mb-6 border-b border-[#1a1a1d] pb-4 uppercase tracking-wider">
              Troubleshooting Tips
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Audio synthesis fails?</h4>
                <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-wider font-semibold">
                  Verify that your FastAPI backend service is running locally on port <code>8000</code>, and confirm your Sarvam API Key has valid billing/credits active.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">SRT timestamps misaligned?</h4>
                <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-wider font-semibold">
                  When using SRT subtitle script inputs, ensure the <strong>"Preserve SRT timestamps"</strong> option is ticked to avoid stripped timeline formatting.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
