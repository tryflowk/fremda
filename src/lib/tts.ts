// Text-to-speech on the device's own voices (Web Speech API): free and offline-capable.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = synth?.getVoices() ?? [];
  const base = lang.split('-')[0];
  const matches = voices.filter(v => v.lang.replace('_', '-').startsWith(base));
  if (!matches.length) return null;
  const exact = matches.filter(v => v.lang.replace('_', '-') === lang);
  const pool = exact.length ? exact : matches;
  return pool.find(v => /premium|enhanced|natural|neural|siri|google/i.test(v.name)) ?? pool[0];
}

export function speak(text: string, lang: string, opts: { rate?: number; onEnd?: () => void } = {}) {
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = opts.rate ?? 0.92;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  synth.speak(u);
}

export function stopSpeaking() {
  synth?.cancel();
}

export const canSpeak = !!synth;
