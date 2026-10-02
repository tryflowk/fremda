import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SPEECH_LANG } from '@/lib/books';
import { actions, dueWords, useStore, type SavedWord } from '@/lib/store';
import { speak } from '@/lib/tts';
import { Close, OpenBook, Speaker } from '@/components/Icons';

function highlight(sentence: string, token: string) {
  const i = sentence.toLowerCase().indexOf(token.toLowerCase());
  if (i < 0) return sentence;
  return (
    <>
      {sentence.slice(0, i)}
      <strong className="font-semibold text-ink">{sentence.slice(i, i + token.length)}</strong>
      {sentence.slice(i + token.length)}
    </>
  );
}

export default function Review() {
  const store = useStore();
  // Snapshot the queue when the session opens; forgotten words go back to the end.
  const initial = useMemo(() => dueWords(store).map(w => w.key), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [queue, setQueue] = useState<string[]>(initial);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  const word: SavedWord | undefined = store.words[queue[0]];
  const total = initial.length;

  const grade = (remembered: boolean) => {
    if (!word) return;
    actions.review(word.key, remembered);
    setRevealed(false);
    setQueue(q => (remembered ? q.slice(1) : [...q.slice(1), q[0]]));
    if (remembered) setDone(d => d + 1);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper">
      <header className="flex items-center gap-3.5 py-3 pr-5 pl-2">
        <Link to="/" aria-label="Voltar ao início" className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sand">
          <Close />
        </Link>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-track">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${total ? (done / total) * 100 : 100}%` }}
          />
        </div>
        <span className="w-12 text-right text-sm font-semibold text-muted">
          {done}/{total}
        </span>
      </header>

      {!word ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <OpenBook />
          <h1 className="m-0 font-display text-[28px] font-semibold">
            {total ? 'Revisão feita!' : 'Nada para revisar agora'}
          </h1>
          <p className="m-0 font-book text-[17px] text-ink-2">
            {total
              ? `Você revisou ${total} ${total === 1 ? 'palavra' : 'palavras'}. Elas voltam em alguns dias, na hora certa de não esquecer.`
              : 'Enquanto lê, toque numa palavra e escolha “Guardar”. Ela aparece aqui no dia seguinte.'}
          </p>
          <Link to="/" className="btn-primary mt-4 no-underline">
            Voltar ao início
          </Link>
          {Object.keys(store.words).length > 0 && (
            <Link to="/palavras" className="h-12 font-semibold text-accent">
              Ver todas as palavras guardadas
            </Link>
          )}
        </main>
      ) : (
        <>
          <main className="flex flex-1 flex-col justify-center px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={word.key + queue.length}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                className="card flex flex-col gap-5 p-6"
              >
                <div className="eyebrow text-muted">Você lembra o que significa?</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-[34px] leading-tight font-semibold">{word.token}</div>
                  <button
                    onClick={() => speak(word.token, SPEECH_LANG[word.lang], { rate: 0.8 })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line"
                    aria-label="Ouvir a palavra"
                  >
                    <Speaker />
                  </button>
                </div>
                <p className="m-0 font-book text-[17px] leading-relaxed text-muted">{highlight(word.sentence, word.token)}</p>
                {revealed && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-t border-line pt-4 font-book text-[22px] text-accent"
                  >
                    {word.translation}
                  </motion.div>
                )}
                <button
                  className="self-start text-sm font-semibold text-muted underline-offset-4 hover:underline"
                  onClick={() => {
                    actions.removeWord(word.key);
                    setRevealed(false);
                    setQueue(q => q.slice(1));
                  }}
                >
                  Remover das guardadas
                </button>
              </motion.div>
            </AnimatePresence>
          </main>
          <footer className="px-5 pt-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {revealed ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="h-14 rounded-full border-2 border-line bg-card text-lg font-semibold"
                  onClick={() => grade(false)}
                >
                  Não lembrei
                </button>
                <button className="btn-primary" onClick={() => grade(true)}>
                  Lembrei
                </button>
              </div>
            ) : (
              <button className="btn-primary" onClick={() => setRevealed(true)}>
                Mostrar tradução
              </button>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
