import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, LogOut } from 'lucide-react';
import { useAuthContext } from '@/lib/auth';
import { useProgress } from '@/hooks/useProgress';
import type { UserBookStats } from '@/types/book';

const BOOKS = [
  {
    id: 'grimm-wolf-geisslein',
    title: 'Der Wolf und die sieben Geißlein',
    author: 'Gebrüder Grimm',
    year: 1812,
    sourceLang: 'de',
    targetLang: 'pt-BR',
    totalSegments: 30,
    estimatedMinutes: 10,
    coverGradient: 'from-indigo-900 via-purple-900 to-slate-900',
  },
];

const FLAG: Record<string, string> = {
  de: '🇩🇪',
  'pt-BR': '🇧🇷',
  en: '🇺🇸',
  fr: '🇫🇷',
  es: '🇪🇸',
};

export function LibraryPage() {
  const { user, signOut } = useAuthContext();
  const { getStats, ensureInLibrary } = useProgress(user?.id);
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, UserBookStats>>({});

  useEffect(() => {
    async function load() {
      const results: Record<string, UserBookStats> = {};
      for (const book of BOOKS) {
        const s = await getStats(book.id);
        if (s) results[book.id] = s;
      }
      setStats(results);
    }
    load();
  }, [getStats]);

  async function handleOpen(bookId: string) {
    await ensureInLibrary(bookId);
    const s = stats[bookId];
    const startAt = s?.last_segment_id ?? 0;
    navigate(`/read/${bookId}?from=${startAt}`);
  }

  const progressPct = (bookId: string, total: number) => {
    const s = stats[bookId];
    if (!s) return 0;
    return Math.round((s.segments_done / total) * 100);
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <BookOpen size={22} style={{ color: 'var(--color-accent)' }} />
          <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Fremda Libro
          </span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--color-muted)' }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--color-text)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--color-muted)')}
        >
          <LogOut size={14} />
          Sair
        </button>
      </header>

      {/* Body */}
      <main className="flex-1 px-5 pt-8 pb-12 max-w-2xl w-full mx-auto">
        <p className="text-xs uppercase tracking-widest mb-6" style={{ color: 'var(--color-muted)' }}>
          Sua biblioteca
        </p>

        <div className="grid gap-4">
          {BOOKS.map(book => {
            const pct = progressPct(book.id, book.totalSegments);
            const hasStarted = pct > 0;

            return (
              <div
                key={book.id}
                className="rounded-2xl overflow-hidden border"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                {/* Cover strip */}
                <div className={`h-28 bg-gradient-to-br ${book.coverGradient} flex items-end p-4 relative`}>
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="relative z-10">
                    <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {FLAG[book.sourceLang]} → {FLAG[book.targetLang]}
                    </p>
                    <h2 className="text-base font-semibold text-white leading-snug">
                      {book.title}
                    </h2>
                    <p className="text-xs text-white/60">{book.author}, {book.year}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    {/* Progress bar */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                        {hasStarted ? `${pct}% concluído` : `~${book.estimatedMinutes} min`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: 'var(--color-accent)' }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpen(book.id)}
                    className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                    style={{
                      background: 'var(--color-accent)',
                      color: 'white',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--color-accent-light)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'var(--color-accent)')}
                  >
                    {hasStarted ? 'Continuar' : 'Começar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
