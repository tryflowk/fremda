const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

const memoryCache = new Map<string, string>();

async function generateAudio(text: string, voice = 'Charon'): Promise<string> {
  const cacheKey = `${voice}::${text}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
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
    }
  );

  if (!response.ok) {
    throw new Error(`TTS error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error('No audio data in TTS response');

  const blob = base64ToBlob(audioData, 'audio/wav');
  const url = URL.createObjectURL(blob);
  memoryCache.set(cacheKey, url);
  return url;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export const tts = {
  segment(ttsPrompt: string, voice?: string): Promise<string> {
    return generateAudio(ttsPrompt, voice);
  },

  word(token: string): Promise<string> {
    const prompt = `[clear pronunciation, neutral pace] ${token}`;
    return generateAudio(prompt, 'Charon');
  },

  prefetch(ttsPrompts: string[], voice?: string): void {
    for (const prompt of ttsPrompts) {
      generateAudio(prompt, voice).catch(() => {});
    }
  },

  clearCache(): void {
    for (const url of memoryCache.values()) {
      URL.revokeObjectURL(url);
    }
    memoryCache.clear();
  },
};
