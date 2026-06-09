import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import type { Book, Segment, WordToken } from '@/types/book';
import { tts } from '@/lib/tts';
import { useAuthContext } from '@/lib/auth';
import { useProgress } from '@/hooks/useProgress';
import { ExerciseOverlay } from '@/components/ExerciseOverlay';
import { Spinner } from '@/components/Spinner';

export function ReadingPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { markSegmentDone, markExerciseDone } = useProgress(user?.id);

  const [book, setBook] = useState<Book | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showExercise, setShowExercise] = useState(false);
  const [wordTooltip, setWordTooltip] = useState<{
    token: string; translation: string; x: number; y: number;
  } | null>(null);

  const activeIdxRef = useRef(activeIdx);
  const bookRef = useRef<Book | null>(null);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);
  useEffect(() => { bookRef.current = book; }, [book]);

  // Load book.json
  useEffect(() => {
    fetch(`/content/${bookId}/book.json`)
      .then(r => r.json())
      .then((data: Book) => {
        setBook(data);
        const fromParam = parseInt(searchParams.get('from') ?? '0', 10);
        const startIdx = data.segments.findIndex(s => s.id >= fromParam);
        setActiveIdx(Math.max(0, startIdx));
      });
  }, [bookId, searchParams]);

  const segment = book?.segments[activeIdx];

  function onSegmentEnded() {
    const b = bookRef.current;
    const idx = activeIdxRef.current;
    if (!b) return;
    const seg = b.segments[idx];
    if (seg?.exercise) {
      setShowExercise(true);
    } else {
      doAdvance(idx, 1);
    }
  }

  const doAdvance = useCallback(async (fromIdx: number, direction: 1 | -1) => {
    tts.stop();
    setIsPlaying(false);
    setShowExercise(false);
    const b = bookRef.current;
    if (!b) return;
    const nextIdx = Math.max(0, Math.min(b.segments.length - 1, fromIdx + direction));
    if (direction > 0 && user) {
      const seg = b.segments[fromIdx];
      if (seg) await markSegmentDone(bookId!, seg.id);
    }
    setActiveIdx(nextIdx);
  }, [user, bookId, markSegmentDone]);

  function playCurrentSegment() {
    if (!segment) return;
    tts.stop();
    setIsPlaying(false);
    tts.play(segment.text, {
      lang: 'de-DE',
      onStart: () => setIsPlaying(true),
      onEnd: () => {
        setIsPlaying(false);
        onSegmentEnded();
      },
      onError: (msg) => {
        console.error('TTS error:', msg);
        setIsPlaying(false);
      },
    });
  }

  function handlePlayPause() {
    if (isPlaying) {
      tts.pause();
      setIsPlaying(false);
    } else if (tts.paused) {
      tts.resume();
      setIsPlaying(true);
    } else {
      playCurrentSegment();
    }
  }

  // Quando o segmento muda, limpar estado de play
  const prevActiveIdx = useRef(activeIdx);
  useEffect(() => {
    if (prevActiveIdx.current !== activeIdx) {
      prevActiveIdx.current = activeIdx;
      tts.stop();
      setIsPlaying(false);
    }
  }, [activeIdx]);

  // Word click: tooltip + pronúncia
  function handleWordClick(word: WordToken, e: React.MouseEvent) {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setWordTooltip({
      token: word.token,
      translation: word.translation,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    tts.playWord(word.token, 'de-DE');
  }

  function dismissTooltip() {
    setWordTooltip(null);
  }

  async function handleExerciseDone(correct: boolean) {
    setShowExercise(false);
    if (user && segment?.exercise) {
      await markExerciseDone(bookId!, segment.id, correct);
    }
    doAdvance(activeIdxRef.current, 1);
  }

  // Scroll active sentence into view
  useEffect(() => {
    document.getElementById(`seg-${activeIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx]);

  if (!book) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <Spinner size={36} />
      </div>
    );
  }

  const progress = Math.round(((activeIdx + 1) / book.segments.length) * 100);

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'var(--color-bg)' }}
      onClick={wordTooltip ? dismissTooltip : undefined}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 pt-4 pb-3 border-b sticky top-0 z-10"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
      >
        <button
          onClick={() => { tts.stop(); navigate('/library'); }}
          className="p-2 rounded-xl"
          style={{ color: 'var(--color-muted)' }}
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
            {book.meta.title}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {progress}% · frase {activeIdx + 1}/{book.segments.length}
          </p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-0.5" style={{ background: 'var(--color-border)' }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: 'var(--color-accent)' }}
        />
      </div>

      {/* Sentences */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 scrollbar-none pb-40">
        {book.segments.map((seg, idx) => (
          <SegmentBlock
            key={seg.id}
            id={`seg-${idx}`}
            segment={seg}
            active={idx === activeIdx}
            past={idx < activeIdx}
            onWordClick={handleWordClick}
          />
        ))}
      </div>

      {/* Word tooltip */}
      <AnimatePresence>
        {wordTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 pointer-events-none"
            style={{
              left: Math.min(Math.max(wordTooltip.x - 70, 12), window.innerWidth - 152),
              top: Math.max(wordTooltip.y - 68, 8),
            }}
          >
            <div
              className="rounded-xl px-3 py-2 flex items-center gap-2 shadow-xl text-sm border"
              style={{
                background: 'var(--color-surface-2)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                minWidth: 140,
              }}
            >
              <Volume2 size={13} style={{ color: 'var(--color-accent)' }} />
              <span className="font-semibold">{wordTooltip.token}</span>
              <span style={{ color: 'var(--color-muted)' }}>→</span>
              <span>{wordTooltip.translation}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise overlay */}
      {showExercise && segment?.exercise && (
        <ExerciseOverlay exercise={segment.exercise} onDone={handleExerciseDone} />
      )}

      {/* Player controls */}
      {!showExercise && (
        <div
          className="fixed inset-x-0 bottom-0 px-6 py-4 border-t flex items-center justify-between gap-4"
          style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={() => doAdvance(activeIdx, -1)}
            disabled={activeIdx === 0}
            className="p-3 rounded-xl transition-all active:scale-90 disabled:opacity-30"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <SkipBack size={18} />
          </button>

          {/* Spacers where ±5s were — mantém layout simétrico */}
          <div className="w-12" />

          <button
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-lg"
            style={{ background: 'var(--color-accent)', color: 'white' }}
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
          </button>

          <div className="w-12" />

          <button
            onClick={() => doAdvance(activeIdx, 1)}
            disabled={activeIdx === book.segments.length - 1}
            className="p-3 rounded-xl transition-all active:scale-90 disabled:opacity-30"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <SkipForward size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

interface SegmentBlockProps {
  id: string;
  segment: Segment;
  active: boolean;
  past: boolean;
  onWordClick: (word: WordToken, e: React.MouseEvent) => void;
}

function SegmentBlock({ id, segment, active, past, onWordClick }: SegmentBlockProps) {
  return (
    <motion.div
      id={id}
      animate={{ opacity: past ? 0.3 : active ? 1 : 0.5, scale: active ? 1 : 0.97 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl px-5 py-4"
      style={{
        background: active ? 'var(--color-surface)' : 'transparent',
        border: active ? '1px solid var(--color-border)' : '1px solid transparent',
      }}
    >
      <p className="text-[17px] leading-relaxed flex flex-wrap gap-x-1 gap-y-1" style={{ color: 'var(--color-text)' }}>
        {segment.words.map((word, i) => (
          <WordChip key={i} word={word} active={active} onClick={e => onWordClick(word, e)} />
        ))}
      </p>
    </motion.div>
  );
}

function WordChip({ word, active, onClick }: { word: WordToken; active: boolean; onClick: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="rounded-md cursor-pointer transition-all select-none"
      style={{
        padding: '2px 4px',
        background: hover && active ? 'var(--color-surface-2)' : 'transparent',
        textDecoration: active ? 'underline dotted' : 'none',
        textDecorationColor: 'var(--color-muted)',
        textUnderlineOffset: '3px',
        WebkitTapHighlightColor: 'transparent',
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {word.token}
    </span>
  );
}
