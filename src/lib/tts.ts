const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TTS_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`;

// Cache: base64 string + mimeType para sobreviver à detaching do ArrayBuffer
const cache = new Map<string, { b64: string; mimeType: string }>();

async function fetchAudio(text: string, voice: string): Promise<ArrayBuffer> {
  const cacheKey = `${voice}::${text}`;

  if (cache.has(cacheKey)) {
    const { b64, mimeType } = cache.get(cacheKey)!;
    return b64ToArrayBuffer(b64, mimeType);
  }

  const res = await fetch(`${TTS_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`TTS ${res.status}: ${msg}`);
  }

  const data = await res.json();
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) throw new Error('Resposta TTS sem dados de áudio');

  const mimeType: string = inlineData.mimeType ?? 'audio/wav';
  cache.set(cacheKey, { b64: inlineData.data, mimeType });
  return b64ToArrayBuffer(inlineData.data, mimeType);
}

// Converte base64 → ArrayBuffer, adicionando cabeçalho WAV se o dado for PCM raw
function b64ToArrayBuffer(b64: string, mimeType: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  if (mimeType.includes('pcm') || mimeType.includes('l16')) {
    const rateMatch = mimeType.match(/rate=(\d+)/);
    return pcmToWav(bytes, rateMatch ? +rateMatch[1] : 24000);
  }
  return bytes.buffer;
}

// Envolve PCM raw num container WAV com cabeçalho RIFF
function pcmToWav(pcm: Uint8Array, sampleRate = 24000, channels = 1, bitDepth = 16): ArrayBuffer {
  const buf = new ArrayBuffer(44 + pcm.length);
  const v = new DataView(buf);
  const str = (off: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)));

  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true);
  str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);                                         // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, (sampleRate * channels * bitDepth) / 8, true);   // byte rate
  v.setUint16(32, (channels * bitDepth) / 8, true);                // block align
  v.setUint16(34, bitDepth, true);
  str(36, 'data'); v.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);
  return buf;
}

export const tts = {
  segment: (prompt: string, voice?: string): Promise<ArrayBuffer> =>
    fetchAudio(prompt, voice ?? 'Charon'),

  word: (token: string): Promise<ArrayBuffer> =>
    fetchAudio(`[clear pronunciation, neutral pace] ${token}`, 'Charon'),

  prefetch(prompts: string[], voice?: string): void {
    for (const p of prompts) fetchAudio(p, voice ?? 'Charon').catch(() => {});
  },
};
