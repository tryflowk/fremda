// TTS usando Web Speech API (nativa do browser, gratuita, sem quota)
// Para usar Gemini TTS, configure VITE_GEMINI_API_KEY e
// mude USE_GEMINI para true (requer plano pago ou quota disponível)
const USE_GEMINI = false;

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TTS_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`;

// ---- Web Speech API ----

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

export interface PlayOptions {
  lang?: string;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (msg: string) => void;
}

export const tts = {
  play(text: string, opts: PlayOptions = {}): void {
    if (!synth) { opts.onError?.('Speech API indisponível'); return; }
    synth.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang ?? 'de-DE';
    u.rate = opts.rate ?? 1.0;
    u.onstart = () => opts.onStart?.();
    u.onend = () => opts.onEnd?.();
    u.onerror = (e) => {
      // "interrupted" é disparado quando cancel() é chamado manualmente — ignorar
      if (e.error === 'interrupted') return;
      opts.onError?.(`Speech error: ${e.error}`);
    };
    synth.speak(u);
  },

  playWord(token: string, lang = 'de-DE'): void {
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(token);
    u.lang = lang;
    u.rate = 0.85;
    synth.speak(u);
  },

  pause(): void { synth?.pause(); },
  resume(): void { synth?.resume(); },
  stop(): void { synth?.cancel(); },

  get speaking(): boolean { return synth?.speaking ?? false; },
  get paused(): boolean { return synth?.paused ?? false; },

  prefetch(_prompts: string[], _voice?: string): void {
    // Web Speech API não precisa de prefetch
  },
};

// ---- Gemini TTS (para uso futuro quando houver quota) ----

const _geminiCache = new Map<string, { b64: string; mimeType: string }>();

async function _fetchGeminiAudio(text: string, voice: string): Promise<ArrayBuffer> {
  const key = `${voice}::${text}`;
  if (_geminiCache.has(key)) {
    return _b64ToArrayBuffer(_geminiCache.get(key)!.b64, _geminiCache.get(key)!.mimeType);
  }
  const res = await fetch(`${TTS_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json();
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) throw new Error('TTS: sem dados de áudio na resposta');
  _geminiCache.set(key, { b64: inlineData.data, mimeType: inlineData.mimeType ?? 'audio/wav' });
  return _b64ToArrayBuffer(inlineData.data, inlineData.mimeType ?? 'audio/wav');
}

function _b64ToArrayBuffer(b64: string, mimeType: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (mimeType.includes('pcm') || mimeType.includes('L16') || mimeType.includes('l16')) {
    const rate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] ?? '24000', 10);
    return _pcmToWav(bytes, rate);
  }
  return bytes.buffer;
}

function _pcmToWav(pcm: Uint8Array, sampleRate = 24000, ch = 1, bits = 16): ArrayBuffer {
  const buf = new ArrayBuffer(44 + pcm.length);
  const v = new DataView(buf);
  const s = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true);
  s(8, 'WAVE'); s(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, (sampleRate * ch * bits) / 8, true);
  v.setUint16(32, (ch * bits) / 8, true); v.setUint16(34, bits, true);
  s(36, 'data'); v.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);
  return buf;
}

// Flag para uso futuro
export { USE_GEMINI, _fetchGeminiAudio };
