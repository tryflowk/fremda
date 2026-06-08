import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Play, Pause, SkipBack, SkipForward, Volume2, AlertCircle } from 'lucide-react';
import type { Book, Segment, WordToken } from '@/types/book';
import { tts } from '@/lib/tts';
import { useAuthContext } from '@/lib/auth';
import { useProgress } from '@/hooks/useProgress';
import { ExerciseOverlay } from '@/components/ExerciseOverlay';
import { Spinner } from '@/components/Spinner';

// ---------- AudioContext helpers ----------

function getOrCreateCtx(ref: React.MutableRefObject<AudioContext | null>): AudioContext {
  if (!ref.current || ref.current.state === 'closed') {
    ref.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (ref.current.state === 'suspended') ref.current.resume();
  return ref.current;
}

function stopNode(node: AudioBufferSourceNode | null) {
  if (!node) return;
  node.onended = null;
  try { node.stop(); } catch { /* already stopped */ }
  node.disconnect();
}

// ---------- Component ----------

export function ReadingPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { markSegmentDone, markExerciseDone } = useProgress(user?.id);

  const [book, setBook] = useState<Book | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showExercise, setShowExercise] = useState(false);
  const [wordTooltip, setWordTooltip] = useState<{
    token: string; translation: string; x: number; y: number;
  } | null>(null);

  // AudioContext refs — persist across renders without causing re-renders
  const ctxRef = useRef<AudioContext | null>(null);
  const srcNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const playStartRef = useRef(0);   // ctx.currentTime when source started
  const playOffsetRef = useRef(0);  // position in buffer (seconds)
  const activeIdxRef = useRef(activeIdx);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

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

  // Prefetch upcoming segments
  const prefetch = useCallback(
    (idx: number) => {
      if (!book) return;
      tts.prefetch(
        book.segments.slice(idx + 1, idx + 4).map(s => s.tts_prompt),
        book.meta.tts_voice
      );
    },
    [book]
  );

  // ---- Audio playback ----

  function startPlayback(buffer: AudioBuffer, offset = 0) {
    const ctx = ctxRef.current!;
    stopNode(srcNodeRef.current);

    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    node.onended = () => {
      if (srcNodeRef.current === node) {
        srcNodeRef.current = null;
        setIsPlaying(false);
        onSegmentEnded();
      }
    };
    node.start(0, Math.max(0, Math.min(offset, buffer.duration - 0.01)));
    srcNodeRef.current = node;
    playStartRef.current = ctx.currentTime - offset;
    setIsPlaying(true);
  }

  const playSegment = useCallback(async () => {
    if (!segment || !book) return;

    // Unlock AudioContext synchronously (must be in user gesture call stack)
    const ctx = getOrCreateCtx(ctxRef);

    stopNode(srcNodeRef.current);
    srcNodeRef.current = null;
    bufferRef.current = null;
    playOffsetRef.current = 0;
    setIsPlaying(false);
    setAudioLoading(true);
    setAudioError(null);

    try {
      const arrayBuf = await tts.segment(segment.tts_prompt, book.meta.tts_voice);
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      bufferRef.current = audioBuf;
      startPlayback(audioBuf, 0);
      prefetch(activeIdxRef.current);
    } catch (e) {
      console.error('TTS error:', e);
      setAudioError('Falha no áudio. Verifique a conexão e a chave Gemini.');
    } finally {
      setAudioLoading(false);
    }
  }, [segment, book, prefetch]);

  function handlePlayPause() {
    const ctx = getOrCreateCtx(ctxRef);

    if (isPlaying) {
      playOffsetRef.current = ctx.currentTime - playStartRef.current;
      stopNode(srcNodeRef.current);
      srcNodeRef.current = null;
      setIsPlaying(false);
    } else if (bufferRef.current) {
      startPlayback(bufferRef.current, playOffsetRef.current);
    } else {
      playSegment();
    }
  }

  function seekRelative(seconds: number) {
    const ctx = getOrCreateCtx(ctxRef);
    if (!bufferRef.current) return;

    const current = isPlaying
      ? ctx.currentTime - playStartRef.current
      : playOffsetRef.current;
    const next = Math.max(0, Math.min(bufferRef.current.duration, current + seconds));
    playOffsetRef.current = next;
    if (isPlaying) startPlayback(bufferRef.current, next);
  }

  function onSegmentEnded() {
    const seg = book?.segments[activeIdxRef.current];
    if (seg?.exercise) {
      setShowExercise(true);
    } else {
      advanceSegment(1);
    }
  }

  async function advanceSegment(direction: 1 | -1 = 1) {
    if (!book) return;
    stopNode(srcNodeRef.current);
    srcNodeRef.current = null;
    bufferRef.current = null;
    playOffsetRef.current = 0;
    setIsPlaying(false);
    setAudioError(null);

    const nextIdx = Math.max(0, Math.min(book.segments.length - 1, activeIdxRef.current + direction));
    if (direction > 0 && user && segment) {
      await markSegmentDone(bookId!, segment.id);
    }
    setActiveIdx(nextIdx);
  }

  async function handleExerciseDone(correct: boolean) {
    setShowExercise(false);
    if (user && segment?.exercise) {
      await markExerciseDone(bookId!, segment.id, correct);
    }
    advanceSegment(1);
  }

  // Word click: show tooltip + play pronunciation via AudioContext
  async function handleWordClick(word: WordToken, e: React.MouseEvent) {
    e.stopPropagation();

    const ctx = getOrCreateCtx(ctxRef);

    // Pause main narration if playing
    if (isPlaying && bufferRef.current) {
      playOffsetRef.current = ctx.currentTime - playStartRef.current;
      stopNode(srcNodeRef.current);
      srcNodeRef.current = null;
      setIsPlaying(false);
    }

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setWordTooltip({
      token: word.token,
      translation: word.translation,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });

    try {
      const arrayBuf = await tts.word(word.token);
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      const node = ctx.createBufferSource();
      node.buffer = audioBuf;
      node.connect(ctx.destination);
      node.start();
    } catch {
      // word audio failure is non-critical
    }
  }

  function dismissTooltip() {
    setWordTooltip(null);
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
          onClick={() => navigate('/library')}
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

      {/* Error banner */}
      {audioError && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl flex items-start gap-2 text-sm" style={{ background: 'rgba(248,113,113,0.12)', color: 'var(--color-error)' }}>
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{audioError}</span>
        </div>
      )}

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
            onClick={() => advanceSegment(-1)}
            disabled={activeIdx === 0}
            className="p-3 rounded-xl transition-all active:scale-90 disabled:opacity-30"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={() => seekRelative(-5)}
            className="text-xs font-medium px-3 py-2 rounded-xl transition-all active:scale-90"
            style={{ background: 'var(--color-surface)', color: 'var(--color-muted)' }}
          >
            −5s
          </button>

          {/* Main play/pause button */}
          <button
            onClick={isPlaying ? handlePlayPause : playSegment}
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-lg"
            style={{ background: 'var(--color-accent)', color: 'white' }}
          >
            {audioLoading ? (
              <Spinner size={22} />
            ) : isPlaying ? (
              <Pause size={22} />
            ) : (
              <Play size={22} className="ml-0.5" />
            )}
          </button>

          <button
            onClick={() => seekRelative(5)}
            className="text-xs font-medium px-3 py-2 rounded-xl transition-all active:scale-90"
            style={{ background: 'var(--color-surface)', color: 'var(--color-muted)' }}
          >
            +5s
          </button>

          <button
            onClick={() => advanceSegment(1)}
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
        minHeight: 44,       // touch target
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {word.token}
    </span>
  );
}
