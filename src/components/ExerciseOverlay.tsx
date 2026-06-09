import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Exercise } from '@/types/book';

interface Props {
  exercise: Exercise;
  onDone: (correct: boolean) => void;
}

export function ExerciseOverlay({ exercise, onDone }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [chips, setChips] = useState<string[]>(exercise.chips ?? []);
  const [order, setOrder] = useState<string[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>(() => shuffle(exercise.options ?? []));

  useEffect(() => {
    setSelected(null);
    setFeedback(null);
    setChips(shuffle(exercise.chips ?? []));
    setShuffledOptions(shuffle(exercise.options ?? []));
    setOrder([]);
  }, [exercise.id]);

  const submit = useCallback(
    (answer: string) => {
      if (feedback) return;
      const correct = answer.trim().toLowerCase() === exercise.answer.trim().toLowerCase();
      setFeedback(correct ? 'correct' : 'wrong');
      // Correct: keep the flow snappy and auto-advance.
      // Wrong: stay open so the user can study the mistake; they tap "Continuar".
      if (correct) setTimeout(() => onDone(true), 800);
    },
    [exercise.answer, feedback, onDone]
  );

  function handleOption(opt: string) {
    if (feedback) return;
    setSelected(opt);
    submit(opt);
  }

  function handleChipAdd(chip: string) {
    if (feedback) return;
    const next = [...order, chip];
    setChips(prev => prev.filter(c => c !== chip));
    setOrder(next);
  }

  function handleChipRemove(chip: string) {
    if (feedback) return;
    setOrder(prev => prev.filter(c => c !== chip));
    setChips(prev => [...prev, chip]);
  }

  function handleSubmitOrder() {
    if (feedback || order.length === 0) return;
    submit(order.join(' '));
  }

  const bgColor = feedback === 'correct'
    ? 'var(--color-success-bg)'
    : feedback === 'wrong'
    ? 'var(--color-error-bg)'
    : 'var(--color-surface)';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl p-6 border-t"
        style={{
          background: bgColor,
          borderColor: 'var(--color-border)',
          transition: 'background 0.3s ease',
          maxHeight: '70dvh',
          overflowY: 'auto',
        }}
      >
        {/* Feedback banner */}
        {feedback && (
          <p
            className="text-center text-sm font-semibold mb-3"
            style={{ color: feedback === 'correct' ? 'var(--color-success)' : 'var(--color-error)' }}
          >
            {feedback === 'correct' ? '✓ Correto!' : `✗ Resposta correta: ${exercise.answer}`}
          </p>
        )}

        <p className="text-base font-medium mb-5 leading-snug" style={{ color: 'var(--color-text)' }}>
          {exercise.prompt}
        </p>

        {/* word_select | fill_blank with options | yes_no */}
        {(exercise.type === 'word_select' || (exercise.type === 'fill_blank' && exercise.options) || exercise.type === 'yes_no') && (
          <div className="grid grid-cols-2 gap-2.5">
            {(exercise.type === 'yes_no' ? ['sim', 'não'] : shuffledOptions).map(opt => {
              const isSelected = selected === opt;
              const isCorrect = opt.toLowerCase() === exercise.answer.toLowerCase();
              let bg = 'var(--color-surface-2)';
              let border = 'var(--color-border)';
              let color = 'var(--color-text)';
              if (feedback && isCorrect) {
                bg = 'var(--color-success-bg)';
                border = 'var(--color-success)';
                color = 'var(--color-success)';
              } else if (feedback && isSelected && !isCorrect) {
                bg = 'var(--color-error-bg)';
                border = 'var(--color-error)';
                color = 'var(--color-error)';
              }
              return (
                <button
                  key={opt}
                  onClick={() => handleOption(opt)}
                  disabled={!!feedback}
                  className="py-3 px-4 rounded-xl text-sm font-medium border transition-all active:scale-95 disabled:cursor-default"
                  style={{ background: bg, borderColor: border, color }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* fill_blank without options — simple text input */}
        {exercise.type === 'fill_blank' && !exercise.options && (
          <FillBlankInput onSubmit={submit} feedback={feedback} answer={exercise.answer} />
        )}

        {/* word_order */}
        {exercise.type === 'word_order' && (
          <div className="flex flex-col gap-3">
            {/* Drop zone */}
            <div
              className="min-h-12 rounded-xl p-3 flex flex-wrap gap-2 border"
              style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
            >
              {order.length === 0 && (
                <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
                  Toque nas palavras abaixo para ordenar...
                </span>
              )}
              {order.map((chip, i) => (
                <ChipButton key={`${chip}-${i}`} label={chip} onClick={() => handleChipRemove(chip)} active />
              ))}
            </div>
            {/* Available chips */}
            <div className="flex flex-wrap gap-2">
              {chips.map((chip, i) => (
                <ChipButton key={`${chip}-${i}`} label={chip} onClick={() => handleChipAdd(chip)} />
              ))}
            </div>
            <button
              onClick={handleSubmitOrder}
              disabled={order.length === 0 || !!feedback}
              className="py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-95"
              style={{ background: 'var(--color-accent)', color: 'white' }}
            >
              Confirmar
            </button>
          </div>
        )}

        {/* translate_word */}
        {exercise.type === 'translate_word' && exercise.options && (
          <div className="flex flex-wrap gap-2">
            {shuffledOptions.map(opt => {
              const isCorrect = opt === exercise.answer;
              const isSelected = selected === opt;
              let bg = 'var(--color-surface-2)';
              let border = 'var(--color-border)';
              let color = 'var(--color-text)';
              if (feedback && isCorrect) { bg = 'var(--color-success-bg)'; border = 'var(--color-success)'; color = 'var(--color-success)'; }
              else if (feedback && isSelected) { bg = 'var(--color-error-bg)'; border = 'var(--color-error)'; color = 'var(--color-error)'; }
              return (
                <button
                  key={opt}
                  onClick={() => handleOption(opt)}
                  disabled={!!feedback}
                  className="py-2 px-4 rounded-xl text-sm font-medium border transition-all active:scale-95"
                  style={{ background: bg, borderColor: border, color }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* Wrong answer: stay open until the user is ready to move on */}
        {feedback === 'wrong' && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => onDone(false)}
            className="w-full mt-5 py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'var(--color-accent)', color: 'white' }}
          >
            Continuar
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function ChipButton({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all active:scale-95"
      style={{
        background: active ? 'var(--color-accent)' : 'var(--color-surface-2)',
        borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
        color: active ? 'white' : 'var(--color-text)',
      }}
    >
      {label}
    </button>
  );
}

function FillBlankInput({ onSubmit, feedback, answer }: { onSubmit: (v: string) => void; feedback: 'correct' | 'wrong' | null; answer: string }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSubmit(value)}
        disabled={!!feedback}
        placeholder={feedback ? answer : 'Digite a palavra...'}
        className="flex-1 rounded-xl px-4 py-3 text-sm border outline-none"
        style={{
          background: 'var(--color-surface-2)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
        }}
      />
      <button
        onClick={() => onSubmit(value)}
        disabled={!value || !!feedback}
        className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-95"
        style={{ background: 'var(--color-accent)', color: 'white' }}
      >
        OK
      </button>
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
