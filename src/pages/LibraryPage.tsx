import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, ChevronDown, Settings, ShoppingBag, Volume2, Smartphone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthContext } from '@/lib/auth';
import { useProgress } from '@/hooks/useProgress';
import { usePrefs } from '@/hooks/usePrefs';
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
  const { prefs, loaded: prefsLoaded, save: savePrefs } = usePrefs(user?.id);
  const navigate = useNavigate();

  const [books, setBooks] = useState<BookRow[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Record<string, UserBookStats>>({});
  const [selectedLang, setSelectedLang] = useState('de');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [buying, setBuying] = useState<BookRow | null>(null);
  const [buyTtsPro, setBuyTtsPro] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);

  // Restore last-read language once prefs arrive
  useEffect(() => {
    if (prefsLoaded && prefs.library_lang) setSelectedLang(prefs.library_lang);
  }, [prefsLoaded, prefs.library_lang]);

  // Load books + purchases
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('books').select('*').eq('published', true).order('created_at', { ascending: true }),
      supabase.from('user_library').select('book_id').eq('user_id', user.id).eq('purchased', true),
    ]).then(([booksRes, ownedRes]) => {
      setBooks(booksRes.data ?? []);
      setOwned(new Set((ownedRes.data ?? []).map(r => r.book_id as string)));
      setLoading(false);
    });
  }, [user]);

  // Load user stats for owned books
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

  const langBooks = books.filter(b => b.source_language === selectedLang);
  const myBooks = langBooks.filter(b => owned.has(b.id));
  const storeBooks = langBooks.filter(b => !owned.has(b.id));
  const selectedLanguage = LANGUAGES.find(l => l.code === selectedLang)!;

  async function handleOpen(bookId: string, lang: string) {
    await ensureInLibrary(bookId);
    savePrefs({ library_lang: lang }); // remember where the user reads
    const s = stats[bookId];
    const startAt = s?.last_segment_id ?? 0;
    navigate(`/read/${bookId}?from=${startAt}`);
  }

  async function confirmPurchase() {
    if (!buying || !user) return;
    setConfirming(true);
    await supabase.from('user_library').upsert({
      user_id: user.id,
      book_id: buying.id,
      purchased: true,
      tts_pro: buyTtsPro,
    });
    setOwned(prev => new Set([...prev, buying.id]));
    setConfirming(false);
    setBuying(null);
    setBuyTtsPro(false);
  }

  const progressPct = (bookId: string, total: number) => {
    const s = stats[bookId];
    if (!s) return 0;
    return Math.round((s.segments_done / total) * 100);
  };

  function selectLang(code: string) {
    setSelectedLang(code);
    setShowLangPicker(false);
    savePrefs({ library_lang: code });
  }

  function BookCard({ book, store }: { book: BookRow; store?: boolean }) {
    const pct = progressPct(book.id, book.total_segments);
    const hasStarted = pct > 0;
    const gradient = book.cover_gradient ?? DEFAULT_GRADIENT;
    return (
      <div
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
                {store ? `~${book.estimated_minutes ?? '?'} min de leitura`
                  : hasStarted ? `${pct}% concluído` : `~${book.estimated_minutes ?? '?'} min`}
              </span>
            </div>
            {!store && (
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: 'var(--color-accent)' }}
                />
              </div>
            )}
          </div>

          {store ? (
            <button
              onClick={() => { setBuying(book); setBuyTtsPro(false); }}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 border"
              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
            >
              <ShoppingBag size={14} /> Comprar
            </button>
          ) : (
            <button
              onClick={() => handleOpen(book.id, book.source_language)}
              className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{ background: 'var(--color-accent)', color: 'white' }}
            >
              {hasStarted ? 'Continuar' : 'Começar'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col overflow-x-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-30"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
      >
        <div className="flex items-center gap-2">
          <BookOpen size={22} style={{ color: 'var(--color-accent)' }} />
          <span className="text-lg font-semibold tracking-tight hidden sm:inline" style={{ color: 'var(--color-text)' }}>
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

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(v => !v)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: showSettings ? 'var(--color-accent)' : 'var(--color-muted)' }}
          >
            <Settings size={17} />
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm px-2 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-muted)' }}
          >
            <LogOut size={14} />
          </button>
        </div>
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
              className="fixed z-30 rounded-2xl border shadow-2xl p-3"
              style={{
                top: 64,
                right: 16,
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
                  const bookCount = books.filter(b => b.source_language === lang.code && owned.has(b.id)).length;
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

      {/* Settings dropdown */}
      <AnimatePresence>
        {showSettings && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowSettings(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="fixed z-30 rounded-2xl border shadow-2xl p-4"
              style={{
                top: 64,
                right: 16,
                width: 'min(300px, calc(100vw - 32px))',
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-muted)' }}>
                Preferências
              </p>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Lado do botão de avançar
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(['left', 'right'] as const).map(side => (
                  <button
                    key={side}
                    onClick={() => savePrefs({ next_button_side: side })}
                    className="py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-95"
                    style={{
                      borderColor: prefs.next_button_side === side ? 'var(--color-accent)' : 'var(--color-border)',
                      background: prefs.next_button_side === side ? 'var(--color-surface-2)' : 'transparent',
                      color: prefs.next_button_side === side ? 'var(--color-accent)' : 'var(--color-muted)',
                    }}
                  >
                    {side === 'left' ? '← Esquerda' : 'Direita →'}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
                O botão de leitura sem áudio na tela do livro.
              </p>
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
        ) : (
          <>
            {myBooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <span className="text-5xl">{selectedLanguage.flag}</span>
                <p className="text-sm text-center" style={{ color: 'var(--color-muted)' }}>
                  Você ainda não tem livros em {selectedLanguage.name}.
                  {storeBooks.length > 0 && ' Veja os disponíveis abaixo!'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {myBooks.map(book => <BookCard key={book.id} book={book} />)}
              </div>
            )}

            {/* Store */}
            {storeBooks.length > 0 && (
              <>
                <p className="text-xs uppercase tracking-widest mt-10 mb-6 flex items-center gap-2" style={{ color: 'var(--color-muted)' }}>
                  <ShoppingBag size={13} /> Comprar novos livros
                </p>
                <div className="grid gap-4">
                  {storeBooks.map(book => <BookCard key={book.id} book={book} store />)}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Purchase sheet */}
      <AnimatePresence>
        {buying && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setBuying(null)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl p-6 border-t"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{buying.title}</h3>
                <button onClick={() => setBuying(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--color-muted)' }}>
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--color-muted)' }}>
                {buying.author}{buying.year ? `, ${buying.year}` : ''} · {FLAG[buying.source_language] ?? '🌐'} → {FLAG[buying.target_language] ?? '🌐'}
              </p>

              <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>Narração</p>
              <div className="grid gap-2 mb-6">
                <button
                  onClick={() => setBuyTtsPro(false)}
                  className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: !buyTtsPro ? 'var(--color-accent)' : 'var(--color-border)',
                    background: !buyTtsPro ? 'var(--color-surface-2)' : 'transparent',
                  }}
                >
                  <Smartphone size={18} style={{ color: !buyTtsPro ? 'var(--color-accent)' : 'var(--color-muted)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Voz do celular</p>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Usa o leitor de voz do seu aparelho</p>
                  </div>
                </button>
                <button
                  onClick={() => setBuyTtsPro(true)}
                  className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: buyTtsPro ? 'var(--color-accent)' : 'var(--color-border)',
                    background: buyTtsPro ? 'var(--color-surface-2)' : 'transparent',
                  }}
                >
                  <Volume2 size={18} style={{ color: buyTtsPro ? 'var(--color-accent)' : 'var(--color-muted)' }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                      Narração Pro
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--color-accent)', color: 'white' }}>
                        EM BREVE
                      </span>
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Áudio de estúdio, baixado no aparelho</p>
                  </div>
                </button>
              </div>

              <button
                onClick={confirmPurchase}
                disabled={confirming}
                className="w-full py-3.5 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'var(--color-accent)', color: 'white' }}
              >
                {confirming ? 'Confirmando…' : 'Comprar — grátis na fase de testes'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
