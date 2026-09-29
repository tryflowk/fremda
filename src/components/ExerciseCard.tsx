import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Exercise } from '@/lib/types';

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
}

export function ExerciseCard({ ex, onAnswer, onNext }: Props) {
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
  };

  const isOrder = ex.type === 'word_order';
  const sentence = built.map(i => chips[i]).join(' ');
  const canCheck = isOrder && built.length === chips.length && !answered;

  const correctAnswer = ex.type === 'yes_no' ? (norm(ex.answer) === 'sim' ? 'Sim' : 'Não') : ex.answer;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 pt-6 pb-4">
        <div className="eyebrow text-accent">Sobre o que você leu</div>
        <h2 className="font-display text-[26px] leading-[1.2] font-semibold text-balance">{ex.prompt}</h2>

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
                  className={`min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-[17px] font-semibold transition active:scale-[.98] ${tone}`}
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
            <div className="text-[17px] font-semibold">{correct ? 'Isso mesmo!' : 'Quase!'}</div>
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
