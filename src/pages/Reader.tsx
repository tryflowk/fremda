import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Book, BookEntry, Segment } from '@/lib/types';
import {
  assetUrl, chapterOf, denselyGlossed, LANG_NAME, loadBook, loadCatalog, pageOf, paginate, piecesOf, SPEECH_LANG,
  type Piece,
} from '@/lib/books';
import { actions, getState, streakOf, todayLog, useStore, wordKey } from '@/lib/store';
import { speak, stopSpeaking } from '@/lib/tts';
import { ExerciseCard } from '@/components/ExerciseCard';
import { pageSteps } from '@/lib/generate';
import { Bookmark, Close, Flame, Languages, Speaker } from '@/components/Icons';
import { Burst, Ring, Sprig, StarField } from '@/components/Decor';

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
      const st = pageSteps(b, pgs[p], b.meta.source_language, getState());
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
  // Built once per page: saved words due now become part of this page's practice.
  const steps = useMemo(
    () => (book && page ? pageSteps(book, page, book.meta.source_language, getState()) : []),
    [book, page],
  );
  const cur = steps[step];

  const [sel, setSel] = useState<Selection | null>(null);
  const [showGloss, setShowGloss] = useState(false);
  const [session, setSession] = useState({ answered: 0, correct: 0, saved: 0, startSentences: 0 });
  const [combo, setCombo] = useState(0);

  const lang = entry?.lang ?? 'de';
  const speechLang = SPEECH_LANG[lang];

  // A second tap right after the first (a double tap, or a tap landing on the button that
  // just took the old one's place) must not skip the sentence that only just appeared.
  const lastMove = useRef(0);
  const tooSoon = () => {
    const now = performance.now();
    if (now - lastMove.current < 450) return true;
    lastMove.current = now;
    return false;
  };

  const advance = useCallback(() => {
    if (!cur || cur.kind === 'done' || tooSoon()) return;
    if (cur.kind === 'seg') actions.readSentence(bookId, cur.seg + 1);
    stopSpeaking();
    setSel(null);
    setShowGloss(false);
    setStep(s => Math.min(s + 1, steps.length - 1));
  }, [cur, bookId, steps.length]);

  const nextPage = () => {
    if (pageIdx === null || tooSoon()) return;
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

  // Keep the sentence being read at the same comfortable height (about a third down the
  // screen) instead of letting it drift towards the bottom edge as the page fills up.
  const currentRef = useRef<HTMLDivElement>(null);
  const curKind = cur?.kind;
  useEffect(() => {
    if (curKind !== 'seg') return;
    const id = requestAnimationFrame(() => {
      const el = currentRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top - window.innerHeight * 0.3), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [step, curKind]);

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
  const chapter = chapterOf(pages, pageIdx!);
  const chapterPagesLeft = chapter.end - pageIdx!;
  // Sentences still to read in this chapter, counting the current one.
  const chapterLeft =
    page.segs.length -
    (cur.kind === 'seg' ? page.segs.indexOf(cur.seg) : page.segs.length) +
    pages.slice(pageIdx! + 1, chapter.end + 1).reduce((n, p) => n + p.segs.length, 0);

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
            className="h-full rounded-full bg-gradient-to-r from-accent to-ember shadow-[inset_0_-3px_0_rgba(0,0,0,.12),inset_0_2px_0_rgba(255,255,255,.35)]"
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
            <h1 className="mt-1.5 font-display text-[26px] leading-[1.15] font-semibold">
              {page.title ?? entry.title}
            </h1>
            <p className="mt-1.5 mb-6 text-[15px] text-muted">
              {chapterPagesLeft > 0
                ? `${chapter.title ? 'Neste capítulo' : 'No livro'}: mais ${chapterPagesLeft === 1 ? '1 página' : `${chapterPagesLeft} páginas`} depois desta`
                : chapterLeft > 1
                  ? `Última página ${chapter.title ? 'do capítulo' : 'do livro'}: faltam ${chapterLeft} frases`
                  : `Última frase ${chapter.title ? 'do capítulo' : 'do livro'}`}
            </p>
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
                      hints={store.settings.hints}
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
            {/* Room below, so even the last sentence can scroll up to reading height. */}
            <div aria-hidden="true" className="h-[40vh] shrink-0" />
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
          ex={cur.ex}
          speechLang={speechLang}
          combo={combo}
          onAnswer={ok => {
            actions.answer(ok);
            if (cur.ex.review) actions.review(cur.ex.review, ok);
            setCombo(c => (ok ? c + 1 : 0));
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
          goal={store.settings.goal}
          streak={streak}
          lastPage={lastPage}
          chapterTitle={chapter.title}
          chapterPagesLeft={chapterPagesLeft}
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
                  {isSaved && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-peach px-2.5 py-0.5 text-[13px] font-semibold text-ink"
                    >
                      <Bookmark filled size={14} /> Guardada. Ela volta nos exercícios.
                    </motion.div>
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
                      if (isSaved) actions.removeWord(savedKey);
                      else
                        actions.saveWord({
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
                      isSaved ? 'border border-peach text-peach' : 'bg-paper text-ink'
                    }`}
                  >
                    <Bookmark filled={isSaved} /> {isSaved ? 'Remover' : 'Guardar'}
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
  hints: boolean;
  lang: BookEntry['lang'];
  onTap: (pieceIndex: number, p: Piece) => void;
}) {
  const { seg, current, interlinear, selected, savedWords, hints, lang, onTap } = props;
  const pieces = useMemo(() => piecesOf(seg), [seg]);
  const hint = hints && !denselyGlossed(seg);

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
          // Saved words stay marked wherever they appear: a solid terracotta underline.
          const savedDeco = saved ? 'underline decoration-accent decoration-[2.5px] underline-offset-[5px]' : '';
          const deco = selected === i
            ? `bg-[#E8D3BA] ${savedDeco}`
            : saved
              ? `${savedDeco} ${current ? '' : 'text-ink-2'}`
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
  chapterTitle: string | null;
  chapterPagesLeft: number;
  onNext: () => void;
  onHome: () => void;
}) {
  const { pageNumber, pageCount, sentences, session, todaySentences, goal, streak, lastPage, chapterTitle, chapterPagesLeft } = props;
  const plural = (n: number) => (n === 1 ? '1 página' : `${n} páginas`);
  const goalHit = todaySentences >= goal;
  const chapterDone = !!chapterTitle && chapterPagesLeft === 0;
  const big = lastPage || chapterDone;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="night fixed inset-0 z-30 mx-auto flex w-full max-w-[480px] flex-col overflow-y-auto"
    >
      <StarField />
      <Sprig className="pointer-events-none absolute -left-6 top-10 h-56 text-leather-2/80" />
      <Sprig flip className="pointer-events-none absolute -right-6 top-16 h-60 text-leather-2/80" />
      <main className="relative flex flex-1 flex-col items-center justify-center gap-5 px-7 pt-10 text-center">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(255,214,150,.55),transparent)]" aria-hidden="true" />
          <Burst n={big ? 18 : 12} radius={big ? 130 : 100} />
          <motion.img
            src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
            alt=""
            initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            className="relative h-24 w-24 rounded-[24px] shadow-[0_0_40px_rgba(255,214,150,.5)]"
          />
        </div>
        <motion.h2
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="m-0 font-display text-[34px] leading-[1.1] font-semibold text-glow"
        >
          {lastPage ? 'Você terminou o livro!' : chapterDone ? 'Capítulo concluído!' : `Página ${pageNumber} lida!`}
        </motion.h2>
        <p className="m-0 font-book text-[17px] text-paper/75">
          {lastPage
            ? 'Que jornada. Escolha o próximo na sua estante.'
            : chapterDone
              ? `Você fechou “${chapterTitle}”. ${pageCount - pageNumber === 1 ? 'Falta' : 'Faltam'} ${plural(pageCount - pageNumber)} no livro.`
              : chapterTitle
                ? `${chapterPagesLeft === 1 ? 'Falta' : 'Faltam'} ${plural(chapterPagesLeft)} para o fim do capítulo.`
                : `${pageCount - pageNumber === 1 ? 'Falta' : 'Faltam'} ${plural(pageCount - pageNumber)} para o fim do livro.`}
        </p>
        <div className="grid w-full grid-cols-3 gap-2.5">
          <Stat value={sentences} label="frases" delay={0.25} />
          <Stat value={session.answered ? `${session.correct}/${session.answered}` : '–'} label="acertos" delay={0.35} />
          <Stat value={Math.max(0, session.saved)} label="palavras guardadas" delay={0.45} />
        </div>
        <div className="flex w-full items-center gap-4 rounded-[20px] border border-white/10 bg-white/[.06] p-4 text-left backdrop-blur">
          <Ring value={todaySentences / goal} size={56} stroke={6} track="rgba(255,255,255,.12)" color={goalHit ? 'var(--color-ok-bright)' : 'var(--color-gold)'}>
            <Flame size={20} lit={streak > 0} />
          </Ring>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-semibold text-gold">
              {streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'}
            </span>
            <span className="text-sm text-paper/70">
              {goalHit ? 'Meta de hoje cumprida. Até amanhã?' : `${Math.min(todaySentences, goal)} de ${goal} frases hoje`}
            </span>
          </div>
        </div>
      </main>
      <footer className="relative flex flex-col gap-2 px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {!lastPage && (
          <button className="btn-gold" onClick={props.onNext} autoFocus>
            {chapterDone ? 'Próximo capítulo' : 'Próxima página'}
          </button>
        )}
        <button className="h-12 font-semibold text-paper/75" onClick={props.onHome}>
          {lastPage ? 'Voltar à estante' : 'Parar por hoje'}
        </button>
      </footer>
    </motion.div>
  );
}

function Stat({ value, label, delay = 0 }: { value: string | number; label: string; delay?: number }) {
  return (
    <motion.div
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
      className="rounded-[18px] border border-white/10 bg-white/[.06] px-1.5 py-3.5"
    >
      <div className="font-display text-[28px] font-semibold text-glow">{value}</div>
      <div className="text-xs text-paper/60">{label}</div>
    </motion.div>
  );
}
