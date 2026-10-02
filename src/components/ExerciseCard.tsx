import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Exercise } from '@/lib/types';
import { speak } from '@/lib/tts';
import { Speaker } from '@/components/Icons';

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[.,!?;:“”"'«»]/g, '').trim().toLowerCase();

function shuffle<T>(xs: T[], seed: string): T[] {
  // Stable per exercise, so options don't jump around on re-render.
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0;
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Props {
  ex: Exercise;
  /** Called once when the reader commits an answer. */
  onAnswer: (correct: boolean) => void;
  onNext: () => void;
  /** BCP-47 voice for the book's language. */
  speechLang: string;
  /** Right answers in a row before this one. */
  combo: number;
}

const wordRe = (w: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{M}])`, 'u');

/** The sentence an exercise is about, with its word highlighted, or blanked until answered. */
function Context({ ex, answered, correct }: { ex: Exercise; answered: boolean; correct: boolean }) {
  const text = ex.context ?? '';
  const t = ex.target ?? '';
  const at = t ? text.search(wordRe(t)) : -1;
  if (at < 0) return <p className="m-0 font-book text-[19px] leading-[1.6] text-ink-2">{text}</p>;
  const word = text.slice(at, at + t.length);
  let mark;
  if (ex.type === 'cloze' && !answered) {
    mark = <span className="mx-0.5 inline-block w-[4.5em] border-b-[2.5px] border-accent align-baseline" aria-label="lacuna">&nbsp;</span>;
  } else {
    const tone = ex.type === 'cloze' ? (correct ? 'bg-ok-bg text-ok-ink' : 'bg-bad-bg text-bad-ink') : 'bg-[#EFD9C2] text-ink';
    mark = <span className={`rounded-md px-1 font-semibold ${tone}`}>{word}</span>;
  }
  return (
    <p className="m-0 font-book text-[19px] leading-[1.6] text-ink-2">
      {text.slice(0, at)}
      {mark}
      {text.slice(at + t.length)}
    </p>
  );
}

export function ExerciseCard({ ex, onAnswer, onNext, speechLang, combo }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [built, setBuilt] = useState<number[]>([]);

  const options = useMemo(
    () => (ex.type === 'yes_no' ? ['Sim', 'Não'] : shuffle(ex.options ?? [], ex.id)),
    [ex],
  );
  const chips = useMemo(() => shuffle(ex.chips ?? [], ex.id), [ex]);

  const answered = picked !== null;
  const correct = answered && norm(picked) === norm(ex.answer);

  const commit = (value: string) => {
    if (answered) return;
    setPicked(value);
    onAnswer(norm(value) === norm(ex.answer));
    // Hear it right once the gap is filled.
    if (ex.type === 'cloze' && ex.context) speak(ex.context, speechLang);
  };

  const play = (rate = 1) => ex.audio && speak(ex.audio, speechLang, { rate });
  useEffect(() => {
    if (ex.type === 'listen') play(0.95);
  }, [ex]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOrder = ex.type === 'word_order';
  const sentence = built.map(i => chips[i]).join(' ');
  const canCheck = isOrder && built.length === chips.length && !answered;

  const correctAnswer = ex.type === 'yes_no' ? (norm(ex.answer) === 'sim' ? 'Sim' : 'Não') : ex.answer;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 pt-6 pb-4">
        <div className="eyebrow text-accent">{ex.label ?? 'Sobre o que você leu'}</div>
        <h2 className="font-display text-[26px] leading-[1.2] font-semibold text-balance">{ex.prompt}</h2>

        {ex.context && (
          <div className="card flex items-start gap-3 p-4">
            <div className="flex-1">
              <Context ex={ex} answered={answered} correct={correct} />
            </div>
            {ex.type === 'meaning' && ex.target && (
              <button
                onClick={() => speak(ex.target!, speechLang, { rate: 0.8 })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line"
                aria-label="Ouvir a palavra"
              >
                <Speaker />
              </button>
            )}
          </div>
        )}

        {ex.type === 'listen' && (
          <div className="flex gap-2.5">
            <button className="btn-soft h-14 flex-1 justify-center text-[17px]" onClick={() => play(0.95)}>
              <Speaker /> Ouvir de novo
            </button>
            <button className="btn-soft h-14 justify-center px-5 text-[17px]" onClick={() => play(0.65)}>
              Devagar
            </button>
          </div>
        )}

        {isOrder ? (
          <div className="flex flex-col gap-4">
            <div className="flex min-h-[64px] flex-wrap content-start gap-2 border-b-2 border-line pb-3">
              {built.map((ci, k) => (
                <button
                  key={`${ci}-${k}`}
                  disabled={answered}
                  onClick={() => setBuilt(b => b.filter((_, j) => j !== k))}
                  className="h-11 rounded-xl border-2 border-line bg-card px-3.5 font-book text-lg"
                >
                  {chips[ci]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {chips.map((c, i) => {
                const used = built.includes(i);
                return (
                  <button
                    key={i}
                    disabled={used || answered}
                    onClick={() => setBuilt(b => [...b, i])}
                    className={`h-11 rounded-xl border-2 px-3.5 font-book text-lg transition ${
                      used ? 'border-dashed border-line bg-transparent text-transparent' : 'border-line bg-card'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-2.5">
            {options.map(o => {
              let tone = 'border-line bg-card text-ink';
              if (answered && norm(o) === norm(correctAnswer)) tone = 'border-ok bg-ok-bg text-ok-ink';
              else if (answered && o === picked) tone = 'border-bad bg-bad-bg text-bad-ink';
              else if (answered) tone = 'border-line bg-card text-faint';
              return (
                <button
                  key={o}
                  onClick={() => commit(o)}
                  disabled={answered}
                  className={`min-h-14 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[.98] ${
                    ex.foreignOptions ? 'font-book text-[18px] leading-snug' : 'text-[17px] font-semibold'
                  } ${tone}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        )}

        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className={`rounded-2xl px-4 py-3.5 ${correct ? 'bg-ok-bg text-ok-ink' : 'bg-bad-bg text-bad-ink'}`}
          >
            <div className="flex items-center justify-between gap-3 text-[17px] font-semibold">
              <span>{correct ? 'Isso mesmo!' : 'Quase!'}</span>
              {correct && combo + 1 >= 3 && (
                <motion.span
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                  className="rounded-full bg-ok px-2.5 py-0.5 text-[13px] text-white"
                >
                  {combo + 1} seguidas
                </motion.span>
              )}
            </div>
            {!correct && (
              <div className="mt-1 font-book text-[15px]">
                Resposta certa: <strong>{correctAnswer}</strong>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="border-t border-track px-5 pt-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {answered ? (
          <button className="btn-primary" onClick={onNext} autoFocus>
            Continuar
          </button>
        ) : isOrder ? (
          <button className="btn-primary" disabled={!canCheck} onClick={() => commit(sentence)}>
            {canCheck ? 'Verificar' : 'Monte a frase'}
          </button>
        ) : (
          <button className="btn-primary" disabled>
            Escolha uma resposta
          </button>
        )}
      </div>
    </div>
  );
}
