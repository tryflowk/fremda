import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Book, BookEntry, Page, Segment } from '@/lib/types';
import {
  assetUrl, denselyGlossed, LANG_NAME, loadBook, loadCatalog, pageOf, paginate, piecesOf, SPEECH_LANG,
  type Piece,
} from '@/lib/books';
import { actions, getState, streakOf, todayLog, useStore, wordKey } from '@/lib/store';
import { speak, stopSpeaking } from '@/lib/tts';
import { ExerciseCard } from '@/components/ExerciseCard';
import { isSupported } from '@/lib/exercises';
import { Bookmark, Close, Flame, Languages, OpenBook, Speaker } from '@/components/Icons';

type Step = { kind: 'seg'; seg: number } | { kind: 'ex'; seg: number } | { kind: 'done' };

function stepsOf(book: Book, page: Page): Step[] {
  const out: Step[] = [];
  for (const i of page.segs) {
    out.push({ kind: 'seg', seg: i });
    const ex = book.segments[i].exercise;
    if (ex && isSupported(ex)) out.push({ kind: 'ex', seg: i });
  }
  out.push({ kind: 'done' });
  return out;
}

interface Selection {
  seg: number;
  piece: number;
  text: string;
  gloss?: Piece['gloss'];
}

/** Remount per book so no page state leaks between books. */
export default function ReaderRoute() {
  const { bookId = '' } = useParams();
  return <Reader key={bookId} bookId={bookId} />;
}

function Reader({ bookId }: { bookId: string }) {
  const navigate = useNavigate();
  const store = useStore();
  const [entry, setEntry] = useState<BookEntry | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageIdx, setPageIdx] = useState<number | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    loadCatalog().then(c => setEntry(c.find(b => b.id === bookId) ?? null));
    loadBook(bookId).then(b => {
      // Resume where the reader left off (first unread sentence).
      const pgs = paginate(b);
      const pos = getState().books[bookId]?.pos ?? 0;
      const p = pageOf(pgs, pos);
      const st = stepsOf(b, pgs[p]);
      const s = st.findIndex(x => x.kind === 'seg' && x.seg >= pos);
      setBook(b);
      setPageIdx(p);
      setStep(s === -1 ? st.length - 1 : s);
    }, e => setError(String(e.message ?? e)));
    actions.openBook(bookId);
    return () => stopSpeaking();
  }, [bookId]);

  const pages = useMemo(() => (book ? paginate(book) : []), [book]);

  const page = pageIdx !== null ? pages[pageIdx] : null;
  const steps = useMemo(() => (book && page ? stepsOf(book, page) : []), [book, page]);
  const cur = steps[step];

  const [sel, setSel] = useState<Selection | null>(null);
  const [showGloss, setShowGloss] = useState(false);
  const [session, setSession] = useState({ answered: 0, correct: 0, saved: 0, startSentences: 0 });

  const lang = entry?.lang ?? 'de';
  const speechLang = SPEECH_LANG[lang];

  const advance = useCallback(() => {
    if (!cur || cur.kind === 'done') return;
    if (cur.kind === 'seg') actions.readSentence(bookId, cur.seg + 1);
    stopSpeaking();
    setSel(null);
    setShowGloss(false);
    setStep(s => Math.min(s + 1, steps.length - 1));
  }, [cur, bookId, steps.length]);

  const nextPage = () => {
    if (pageIdx === null) return;
    setPageIdx(pageIdx + 1);
    setStep(0);
    setSession({ answered: 0, correct: 0, saved: 0, startSentences: todayLog(store).sentences });
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (cur?.kind !== 'seg' || sel) return;
      if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
        if ((e.target as HTMLElement)?.tagName === 'BUTTON' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur, sel, advance]);

  const currentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [step]);

  const streak = streakOf(store.days);

  if (error) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="font-book text-lg">Não consegui abrir este livro.</p>
          <Link to="/" className="btn-soft">Voltar ao início</Link>
        </div>
      </Shell>
    );
  }
  if (!book || !entry || !page || !cur) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center" role="status" aria-label="Carregando">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-track border-t-accent" />
        </div>
      </Shell>
    );
  }

  const progress = step / (steps.length - 1);
  const visibleSegs = page.segs.filter(i =>
    steps.findIndex(s => s.kind === 'seg' && s.seg === i) <= step,
  );
  const lastPage = pageIdx === pages.length - 1;

  const tapWord = (seg: number, piece: number, p: Piece) => {
    setSel({ seg, piece, text: p.text, gloss: p.gloss });
    speak(p.text, speechLang, { rate: 0.85 });
  };

  const savedKey = sel ? wordKey(lang, sel.gloss?.token ?? sel.text) : '';
  const isSaved = !!store.words[savedKey];

  return (
    <Shell>
      <header className="sticky top-0 z-10 flex items-center gap-3.5 bg-paper/95 py-3 pr-5 pl-2 backdrop-blur">
        <Link
          to="/"
          aria-label="Fechar e voltar ao início"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sand"
        >
          <Close />
        </Link>
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-track"
          role="progressbar"
          aria-label="Progresso da página"
          aria-valuenow={Math.round(progress * 100)}
        >
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={false}
            animate={{ width: `${Math.max(progress, 0.02) * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="flex items-center gap-1 font-semibold text-accent" aria-label={`Sequência de ${streak} dias`}>
          <Flame lit={streak > 0} />
          <span>{streak}</span>
        </div>
      </header>

      {cur.kind === 'seg' && (
        <>
          <main className="flex flex-1 flex-col px-7 pb-6">
            <div className="eyebrow mt-2 text-muted">
              {entry.author} · {LANG_NAME[lang]}
            </div>
            <h1 className="mt-1.5 mb-6 font-display text-[26px] leading-[1.15] font-semibold">
              {page.title ?? entry.title}
            </h1>
            <div className="flex flex-col gap-4">
              {visibleSegs.map(i => {
                const isCur = i === cur.seg;
                return (
                  <motion.div
                    key={i}
                    ref={isCur ? currentRef : undefined}
                    initial={isCur ? { opacity: 0, y: 14 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    <Sentence
                      seg={book.segments[i]}
                      current={isCur}
                      interlinear={isCur && showGloss}
                      selected={sel?.seg === i ? sel.piece : null}
                      savedWords={store.words}
                      lang={lang}
                      onTap={(pi, p) => tapWord(i, pi, p)}
                    />
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-soft" onClick={() => speak(book.segments[cur.seg].text, speechLang)}>
                <Speaker /> Ouvir a frase
              </button>
              <button className="btn-soft" onClick={() => setShowGloss(g => !g)} aria-pressed={showGloss}>
                <Languages /> {showGloss ? 'Esconder tradução' : 'Ver tradução'}
              </button>
            </div>
          </main>

          <footer className="sticky bottom-0 border-t border-track bg-paper px-5 pt-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button className="btn-primary" onClick={advance}>
              Continuar
            </button>
          </footer>
        </>
      )}

      {cur.kind === 'ex' && (
        <ExerciseCard
          key={`${pageIdx}-${step}`}
          ex={book.segments[cur.seg].exercise!}
          onAnswer={ok => {
            actions.answer(ok);
            setSession(s => ({ ...s, answered: s.answered + 1, correct: s.correct + (ok ? 1 : 0) }));
          }}
          onNext={advance}
        />
      )}

      {cur.kind === 'done' && (
        <PageDone
          pageNumber={page.index + 1}
          pageCount={pages.length}
          sentences={page.segs.length}
          session={session}
          todaySentences={todayLog(store).sentences}
          goal={store.goal}
          streak={streak}
          lastPage={lastPage}
          onNext={nextPage}
          onHome={() => navigate('/')}
        />
      )}

      <AnimatePresence>
        {sel && cur.kind === 'seg' && (
          <motion.div
            key="sheet"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="fixed inset-x-0 bottom-[96px] z-20 mx-auto w-[calc(100%-24px)] max-w-[456px]"
          >
            <div
              className="flex flex-col gap-3 rounded-[22px] bg-ink px-5 pt-4 pb-4 text-paper shadow-[0_12px_32px_rgba(34,31,27,.3)]"
              role="dialog"
              aria-label={`Palavra: ${sel.text}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="font-display text-[26px] leading-[1.1] font-semibold">{sel.gloss?.token ?? sel.text}</div>
                  {sel.gloss ? (
                    <div className="mt-1 font-book text-lg text-peach">{sel.gloss.translation}</div>
                  ) : (
                    <div className="mt-1 font-book text-[15px] text-[#CFC5B6]">
                      Essa palavra não tem tradução no livro ainda. Toque em “Ver tradução” para as que têm.
                    </div>
                  )}
                  {sel.gloss?.lemma && sel.gloss.lemma.toLowerCase() !== sel.gloss.token.toLowerCase() && (
                    <div className="mt-1 text-[13px] text-[#CFC5B6]">forma básica: {sel.gloss.lemma}</div>
                  )}
                </div>
                <button
                  onClick={() => setSel(null)}
                  aria-label="Fechar"
                  className="-mt-2 -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-[#CFC5B6]"
                >
                  <Close size={20} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => speak(sel.gloss?.token ?? sel.text, speechLang, { rate: 0.8 })}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-ink-2 font-semibold"
                >
                  <Speaker /> Ouvir
                </button>
                {sel.gloss && (
                  <button
                    onClick={() => {
                      actions.toggleWord({
                        key: savedKey,
                        token: sel.gloss!.token,
                        translation: sel.gloss!.translation,
                        lang,
                        bookId,
                        sentence: book.segments[sel.seg].text,
                      });
                      setSession(s => ({ ...s, saved: s.saved + (isSaved ? -1 : 1) }));
                    }}
                    aria-pressed={isSaved}
                    className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full font-semibold ${
                      isSaved ? 'bg-peach text-ink' : 'bg-paper text-ink'
                    }`}
                  >
                    <Bookmark filled={isSaved} /> {isSaved ? 'Guardada' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper">{children}</div>;
}

function Sentence(props: {
  seg: Segment;
  current: boolean;
  interlinear: boolean;
  selected: number | null;
  savedWords: Record<string, unknown>;
  lang: BookEntry['lang'];
  onTap: (pieceIndex: number, p: Piece) => void;
}) {
  const { seg, current, interlinear, selected, savedWords, lang, onTap } = props;
  const pieces = useMemo(() => piecesOf(seg), [seg]);
  const hint = !denselyGlossed(seg);

  return (
    <div>
      {seg.image_url && (
        <img
          src={assetUrl(seg.image_url)}
          alt=""
          className="mx-auto mb-4 max-h-56 w-auto rounded-xl mix-blend-multiply"
          loading="lazy"
        />
      )}
      <p
        className={`m-0 font-book transition-colors ${
          current ? 'text-[23px] leading-[1.62] font-medium text-ink' : 'text-[17px] leading-[1.6] text-faint'
        } ${interlinear ? 'leading-[2.3]' : ''}`}
      >
        {pieces.map((p, i) => {
          if (!p.word) return <span key={i}>{p.text}</span>;
          const saved = p.gloss && savedWords[wordKey(lang, p.gloss.token)];
          const deco = selected === i
            ? 'bg-[#E8D3BA]'
            : saved
              ? 'underline decoration-accent decoration-dotted decoration-2 underline-offset-[5px]'
              : hint && p.gloss && current
                ? 'underline decoration-[#C9BBA6] decoration-dotted decoration-[1.5px] underline-offset-[5px]'
                : '';
          if (interlinear && p.gloss) {
            return (
              <button
                key={i}
                onClick={() => onTap(i, p)}
                className={`relative inline-flex flex-col items-center rounded-md px-px align-baseline hover:bg-sand ${deco}`}
              >
                <span>{p.text}</span>
                <span className="absolute top-full -mt-1.5 font-book text-[12px] leading-none font-normal whitespace-nowrap text-accent italic">
                  {p.gloss.translation}
                </span>
              </button>
            );
          }
          return (
            <button key={i} onClick={() => onTap(i, p)} className={`rounded-md px-px hover:bg-sand ${deco}`}>
              {p.text}
            </button>
          );
        })}
      </p>
    </div>
  );
}

function PageDone(props: {
  pageNumber: number;
  pageCount: number;
  sentences: number;
  session: { answered: number; correct: number; saved: number; startSentences: number };
  todaySentences: number;
  goal: number;
  streak: number;
  lastPage: boolean;
  onNext: () => void;
  onHome: () => void;
}) {
  const { pageNumber, pageCount, sentences, session, todaySentences, goal, streak, lastPage } = props;
  const goalHit = todaySentences >= goal;
  return (
    <>
      <motion.main
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-1 flex-col items-center justify-center gap-5 px-7 text-center"
      >
        <OpenBook />
        <h2 className="m-0 font-display text-[30px] leading-[1.15] font-semibold">
          {lastPage ? 'Você terminou o livro!' : `Página ${pageNumber} lida!`}
        </h2>
        <p className="m-0 font-book text-[17px] text-ink-2">
          {lastPage ? 'Que jornada. Escolha o próximo na sua estante.' : `Faltam ${pageCount - pageNumber} páginas para o fim do livro.`}
        </p>
        <div className="grid w-full grid-cols-3 gap-2.5">
          <Stat value={sentences} label="frases" />
          <Stat value={session.answered ? `${session.correct}/${session.answered}` : '–'} label="acertos" />
          <Stat value={Math.max(0, session.saved)} label="palavras guardadas" />
        </div>
        <div className="card w-full p-4 text-left">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="flex items-center gap-1.5 text-accent">
              <Flame /> {streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'}
            </span>
            <span className="text-muted">
              {Math.min(todaySentences, goal)}/{goal} frases hoje
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(1, todaySentences / goal) * 100}%` }} />
          </div>
          {goalHit && <div className="mt-2.5 font-book text-[15px] text-ok-ink">Meta de hoje cumprida. Até amanhã?</div>}
        </div>
      </motion.main>
      <footer className="flex flex-col gap-2 px-5 pt-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {!lastPage && (
          <button className="btn-primary" onClick={props.onNext} autoFocus>
            Próxima página
          </button>
        )}
        <button className="h-12 font-semibold text-accent" onClick={props.onHome}>
          {lastPage ? 'Voltar à estante' : 'Parar por hoje'}
        </button>
      </footer>
    </>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card px-1.5 py-3.5">
      <div className="font-display text-[26px] font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
