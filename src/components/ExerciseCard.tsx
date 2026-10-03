import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Exercise } from '@/lib/types';
import { speak } from '@/lib/tts';
import { Flame, Speaker } from '@/components/Icons';
import { Burst, Star } from '@/components/Decor';
import { buzz } from '@/lib/buzz';

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

const PRAISE = ['Isso mesmo!', 'Perfeito!', 'Mandou bem!', 'Exato!', 'Muito bem!'];
const NUDGE = ['Quase!', 'Por pouco!', 'Não foi dessa vez'];
const pickBy = (xs: string[], seed: string) => xs[[...seed].reduce((h, c) => h + c.charCodeAt(0), 0) % xs.length];

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
  const [showPassage, setShowPassage] = useState(false);

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
    const ok = norm(value) === norm(ex.answer);
    buzz(ok ? 18 : [40, 50, 40]);
    onAnswer(ok);
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
        <div className="eyebrow flex items-center gap-1.5 self-start rounded-full bg-sand px-3 py-1.5 text-accent">
          <Star size={10} /> {ex.label ?? 'Sobre o que você leu'}
        </div>
        <h2 className="font-display text-[26px] leading-[1.2] font-semibold text-balance">{ex.prompt}</h2>

        {ex.passage &&
          (showPassage ? (
            <div className="card flex items-start gap-3 p-4">
              <p className="m-0 max-h-[36vh] flex-1 overflow-y-auto font-book text-[17px] leading-[1.6] text-ink-2">{ex.passage}</p>
              <button
                onClick={() => speak(ex.passage!, speechLang)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line"
                aria-label="Ouvir o trecho"
              >
                <Speaker />
              </button>
            </div>
          ) : (
            <button className="self-start text-[16px] font-semibold text-accent underline underline-offset-4" onClick={() => setShowPassage(true)}>
              Rever o trecho
            </button>
          ))}

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
              if (answered && norm(o) === norm(correctAnswer)) tone = 'border-ok-bright bg-ok-bg text-ok-ink';
              else if (answered && o === picked) tone = 'animate-shake border-bad-bright bg-bad-bg text-bad-ink';
              else if (answered) tone = 'border-line bg-card text-faint';
              return (
                <button
                  key={o}
                  onClick={() => commit(o)}
                  disabled={answered}
                  className={`option ${
                    ex.foreignOptions ? 'font-book text-[18px] leading-snug' : 'text-[17px] font-semibold'
                  } ${tone}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        )}

      </div>

      {answered ? (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          role="status"
          className={`relative px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] ${correct ? 'bg-ok-bg text-ok-ink' : 'bg-bad-bg text-bad-ink'}`}
        >
          {correct && <Burst className="-top-6 h-0" radius={110} />}
          <div className="mb-3.5 flex items-center gap-3">
            <motion.span
              initial={{ scale: 0.3, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${correct ? 'bg-ok-bright' : 'bg-bad-bright'}`}
            >
              {correct ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              )}
            </motion.span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-[22px] leading-tight font-semibold">{correct ? pickBy(PRAISE, ex.id) : pickBy(NUDGE, ex.id)}</span>
              {!correct && (
                <span className="font-book text-[15px]">
                  Resposta certa: <strong>{correctAnswer}</strong>
                </span>
              )}
            </div>
            {correct && combo + 1 >= 3 && (
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 12, delay: 0.15 }}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-night px-3 py-1.5 text-[13px] font-semibold text-gold shadow-[0_0_18px_rgba(242,194,123,.45)]"
              >
                <Flame size={15} /> {combo + 1} seguidas
              </motion.span>
            )}
          </div>
          <button className={correct ? 'btn-ok' : 'btn-bad'} onClick={onNext} autoFocus>
            Continuar
          </button>
        </motion.div>
      ) : (
        <div className="border-t border-track px-5 pt-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {isOrder ? (
            <button className="btn-primary" disabled={!canCheck} onClick={() => commit(sentence)}>
              {canCheck ? 'Verificar' : 'Monte a frase'}
            </button>
          ) : (
            <button className="btn-primary" disabled>
              Escolha uma resposta
            </button>
          )}
        </div>
      )}
    </div>
  );
}
