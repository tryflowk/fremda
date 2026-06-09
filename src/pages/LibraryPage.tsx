import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '@/lib/auth';
import { useProgress } from '@/hooks/useProgress';
import { supabase } from '@/lib/supabase';
import type { BookRow } from '@/lib/supabase';
import type { UserBookStats } from '@/types/book';

const LANGUAGES = [
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
];

const FLAG: Record<string, string> = {
  de: '🇩🇪', 'pt-BR': '🇧🇷', en: '🇺🇸', fr: '🇫🇷', it: '🇮🇹', es: '🇪🇸',
};

const DEFAULT_GRADIENT = 'from-indigo-900 via-purple-900 to-slate-900';

export function LibraryPage() {
  const { user, signOut } = useAuthContext();
  const { getStats, ensureInLibrary } = useProgress(user?.id);
  const navigate = useNavigate();

  const [books, setBooks] = useState<BookRow[]>([]);
  const [stats, setStats] = useState<Record<string, UserBookStats>>({});
  const [selectedLang, setSelectedLang] = useState('de');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load books from Supabase
  useEffect(() => {
    supabase
      .from('books')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setBooks(data ?? []);
        setLoading(false);
      });
  }, []);

  // Load user stats for all books
  useEffect(() => {
    if (books.length === 0) return;
    async function load() {
      const results: Record<string, UserBookStats> = {};
      for (const book of books) {
        const s = await getStats(book.id);
        if (s) results[book.id] = s;
      }
      setStats(results);
    }
    load();
  }, [books, getStats]);

  const filteredBooks = books.filter(b => b.source_language === selectedLang);
  const selectedLanguage = LANGUAGES.find(l => l.code === selectedLang)!;

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

  function selectLang(code: string) {
    setSelectedLang(code);
    setShowLangPicker(false);
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-30"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
      >
        <div className="flex items-center gap-2">
          <BookOpen size={22} style={{ color: 'var(--color-accent)' }} />
          <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            Fremda Libro
          </span>
        </div>

        <button
          onClick={() => setShowLangPicker(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all"
          style={{
            borderColor: showLangPicker ? 'var(--color-accent)' : 'var(--color-border)',
            background: showLangPicker ? 'var(--color-surface)' : 'transparent',
            color: 'var(--color-text)',
          }}
        >
          <span className="text-lg leading-none">{selectedLanguage.flag}</span>
          <span className="text-sm font-medium">{selectedLanguage.name}</span>
          <ChevronDown
            size={13}
            style={{
              color: 'var(--color-muted)',
              transform: showLangPicker ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />
        </button>

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

      {/* Language picker dropdown */}
      <AnimatePresence>
        {showLangPicker && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowLangPicker(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute left-1/2 z-30 mt-1 rounded-2xl border shadow-2xl p-3"
              style={{
                top: 64,
                transform: 'translateX(-50%)',
                width: 'min(340px, calc(100vw - 32px))',
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              <p className="text-xs uppercase tracking-widest mb-3 px-1" style={{ color: 'var(--color-muted)' }}>
                Idioma dos livros
              </p>
              <div className="grid grid-cols-4 gap-2">
                {LANGUAGES.map(lang => {
                  const bookCount = books.filter(b => b.source_language === lang.code).length;
                  const isSelected = lang.code === selectedLang;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => selectLang(lang.code)}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all active:scale-95 relative"
                      style={{
                        background: isSelected ? 'var(--color-surface-2)' : 'transparent',
                        borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)',
                      }}
                    >
                      <span className="text-2xl leading-none">{lang.flag}</span>
                      <span className="text-xs font-medium" style={{ color: isSelected ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                        {lang.name}
                      </span>
                      {bookCount > 0 && (
                        <span
                          className="absolute top-1.5 right-1.5 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--color-accent)', color: 'white' }}
                        >
                          {bookCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Body */}
      <main className="flex-1 px-5 pt-8 pb-12 max-w-2xl w-full mx-auto">
        <p className="text-xs uppercase tracking-widest mb-6" style={{ color: 'var(--color-muted)' }}>
          Sua biblioteca
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="text-5xl">{selectedLanguage.flag}</span>
            <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Em breve!</p>
            <p className="text-sm text-center" style={{ color: 'var(--color-muted)' }}>
              Estamos preparando livros em {selectedLanguage.name}.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBooks.map(book => {
              const pct = progressPct(book.id, book.total_segments);
              const hasStarted = pct > 0;
              const gradient = book.cover_gradient ?? DEFAULT_GRADIENT;

              return (
                <div
                  key={book.id}
                  className="rounded-2xl overflow-hidden border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <div className={`h-28 bg-gradient-to-br ${gradient} flex items-end p-4 relative`}>
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="relative z-10">
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {FLAG[book.source_language] ?? '🌐'} → {FLAG[book.target_language] ?? '🌐'}
                      </p>
                      <h2 className="text-base font-semibold text-white leading-snug">{book.title}</h2>
                      <p className="text-xs text-white/60">{book.author}{book.year ? `, ${book.year}` : ''}</p>
                    </div>
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                          {hasStarted ? `${pct}% concluído` : `~${book.estimated_minutes ?? '?'} min`}
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
                      style={{ background: 'var(--color-accent)', color: 'white' }}
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
        )}
      </main>
    </div>
  );
}
