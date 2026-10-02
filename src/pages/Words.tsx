import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LANG_NAME, SPEECH_LANG } from '@/lib/books';
import { actions, today, useStore, type SavedWord } from '@/lib/store';
import { speak } from '@/lib/tts';
import { ArrowLeft, Close, Speaker } from '@/components/Icons';

function when(w: SavedWord) {
  const t = today();
  if (w.due <= t) return 'para revisar hoje';
  if (w.due === today(1)) return 'volta amanhã';
  const days = Math.round((new Date(w.due).getTime() - new Date(t).getTime()) / 864e5);
  return `volta em ${days} dias`;
}

export default function Words() {
  const store = useStore();
  const words = Object.values(store.words).sort((a, b) => a.due.localeCompare(b.due) || a.token.localeCompare(b.token));
  const langs = [...new Set(words.map(w => w.lang))];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-5 px-5 pt-4 pb-10">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="Voltar ao início" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sand">
          <ArrowLeft />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[26px] font-semibold">Suas palavras</h1>
        <span className="text-sm font-semibold text-muted">{words.length}</span>
      </header>

      {!words.length && (
        <p className="m-0 font-book text-[17px] text-ink-2">
          Nenhuma palavra guardada ainda. Enquanto lê, toque numa palavra e escolha “Guardar”.
        </p>
      )}

      {langs.map(lang => (
        <section key={lang} className="flex flex-col gap-2">
          {langs.length > 1 && <h2 className="eyebrow m-0 text-muted">{LANG_NAME[lang]}</h2>}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <AnimatePresence initial={false}>
              {words
                .filter(w => w.lang === lang)
                .map(w => (
                  <motion.li
                    key={w.key}
                    layout
                    exit={{ opacity: 0, x: -30 }}
                    className="card flex items-center gap-2 py-2.5 pr-1.5 pl-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-book text-[18px] font-medium">{w.token}</span>
                        <span className="truncate font-book text-[15px] text-accent">{w.translation}</span>
                      </div>
                      <div className="text-xs text-muted">{when(w)}</div>
                    </div>
                    <button
                      onClick={() => speak(w.token, SPEECH_LANG[w.lang], { rate: 0.8 })}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-sand"
                      aria-label={`Ouvir ${w.token}`}
                    >
                      <Speaker />
                    </button>
                    <button
                      onClick={() => actions.removeWord(w.key)}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sand"
                      aria-label={`Remover ${w.token}`}
                    >
                      <Close size={18} />
                    </button>
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
