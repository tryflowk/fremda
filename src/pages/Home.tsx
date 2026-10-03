import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { BookEntry } from '@/lib/types';
import { LANG_CODE, LANG_NAME, loadCatalog } from '@/lib/books';
import { dueWords, streakOf, today, todayLog, useStore } from '@/lib/store';
import { BookCover } from '@/components/BookCover';
import { Cards, Cloud, Flame, Gear } from '@/components/Icons';
import { Ring, Sprig, Star, StarField } from '@/components/Decor';
import { useSync } from '@/lib/sync';

const WEEKDAY = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function Home() {
  const store = useStore();
  const { email } = useSync();
  const goal = store.settings.goal;
  const [books, setBooks] = useState<BookEntry[]>([]);
  useEffect(() => {
    loadCatalog().then(setBooks);
  }, []);

  const streak = streakOf(store.days);
  const todays = todayLog(store);
  const due = dueWords(store);
  const totalWords = Object.keys(store.words).length;
  const current = books.find(b => b.id === store.lastBook) ?? books[0];
  const pct = (b: BookEntry) => Math.min(1, (store.books[b.id]?.pos ?? 0) / b.segments);

  const week = Array.from({ length: 7 }, (_, k) => {
    const off = k - 6;
    const date = today(off);
    const d = new Date();
    d.setDate(d.getDate() + off);
    return { date, label: WEEKDAY[d.getDay()], read: (store.days[date]?.sentences ?? 0) > 0, isToday: off === 0 };
  });

  const reading = current ? !!store.books[current.id] : false;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pb-10">
      <section className="night relative overflow-hidden rounded-b-[36px] px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 shadow-[0_18px_40px_-18px_rgba(28,17,13,.6)]">
        <StarField />
        <Sprig className="pointer-events-none absolute -left-4 top-44 h-48 text-leather-2/70" />
        <Sprig flip className="pointer-events-none absolute -right-4 top-40 h-52 text-leather-2/70" />

        <header className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="h-9 w-9 rounded-[10px] shadow-[0_0_18px_rgba(242,194,123,.35)]" />
            <h1 className="m-0 font-display text-[26px] font-semibold tracking-[-.01em] text-glow">Verba</h1>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 font-semibold text-gold backdrop-blur"
              aria-label={`Sequência de ${streak} dias`}
            >
              <Flame size={18} lit={streak > 0} /> {streak}
            </div>
            <Link
              to="/ajustes"
              aria-label="Ajustes"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-paper/80"
            >
              <Gear size={18} />
            </Link>
          </div>
        </header>

        <ol className="relative m-0 mt-6 flex list-none justify-between p-0" aria-label="Sua semana de leitura">
          {week.map(d => (
            <li key={d.date} className="flex flex-col items-center gap-1.5">
              <span className={`text-[11px] font-semibold ${d.isToday ? 'text-gold' : 'text-paper/50'}`}>{d.label}</span>
              <span
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-full ${
                  d.read
                    ? 'bg-gradient-to-b from-glow to-gold text-accent-deep shadow-[0_0_16px_rgba(242,194,123,.6)]'
                    : d.isToday
                      ? 'border-2 border-dashed border-gold/70'
                      : 'border border-white/12 bg-white/[.03]'
                }`}
                aria-label={d.read ? 'leu neste dia' : 'sem leitura'}
              >
                {d.read && <Star size={14} />}
              </span>
            </li>
          ))}
        </ol>

        {current && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative mt-7 flex flex-col gap-5">
            <div className="flex items-end gap-5">
              <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-[radial-gradient(closest-side,rgba(255,214,150,.45),transparent)]" aria-hidden="true" />
                <div className="animate-drift relative">
                  <BookCover book={current} />
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-1">
                <div className="eyebrow text-gold">
                  {reading ? 'Continue lendo' : 'Comece por aqui'} · {LANG_NAME[current.lang]}
                </div>
                <h2 className="m-0 font-display text-[24px] leading-[1.15] font-semibold text-paper">{current.title_pt}</h2>
                <p className="m-0 font-book text-sm leading-snug text-paper/65">
                  {reading ? `${current.author} · ${Math.round(pct(current) * 100)}% lido` : current.blurb}
                </p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-gold to-glow shadow-[0_0_12px_rgba(255,214,150,.7)]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct(current), 0.02) * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <Link to={`/ler/${current.id}`} className="btn-gold">
              {reading ? 'Continuar lendo' : 'Começar a ler'}
            </Link>
          </motion.div>
        )}
      </section>

      <div className="flex flex-col gap-6 px-5 pt-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="card flex flex-col gap-2 p-4" aria-label={`Meta de hoje: ${todays.sentences} de ${goal} frases`}>
            <span className="text-[13px] font-semibold text-muted">Meta de hoje</span>
            <div className="flex items-center gap-3">
              <Ring value={todays.sentences / goal} size={52} stroke={6} color={todays.sentences >= goal ? 'var(--color-ok-bright)' : 'var(--color-accent)'}>
                {todays.sentences >= goal ? (
                  <Star size={18} className="text-ok-bright" />
                ) : (
                  <span className="text-[12px] font-bold text-ink-2">{Math.round(Math.min(1, todays.sentences / goal) * 100)}%</span>
                )}
              </Ring>
              <span className="flex flex-col leading-tight">
                <span className="font-display text-[26px] font-semibold">{todays.sentences}</span>
                <span className="text-[13px] text-muted">de {goal} frases</span>
              </span>
            </div>
          </div>
          <Link
            to={due.length || !totalWords ? '/revisar' : '/palavras'}
            className={`relative flex flex-col gap-1.5 overflow-hidden rounded-[20px] p-4 no-underline ${due.length ? 'night' : 'card text-ink'}`}
          >
            <span className={`flex items-center justify-between text-[13px] font-semibold ${due.length ? 'text-gold' : 'text-muted'}`}>
              Revisar palavras <Cards size={18} />
            </span>
            <span className="flex items-baseline gap-1">
              <span className="font-display text-[30px] font-semibold">{due.length}</span>
              <span className={due.length ? 'text-paper/70' : 'text-muted'}>{due.length === 1 ? 'pronta' : 'prontas'}</span>
            </span>
            <span className={`truncate font-book text-sm ${due.length ? 'text-paper/80' : 'text-ink-2'}`}>
              {due.length
                ? due.slice(0, 3).map(w => w.token).join(', ')
                : totalWords
                  ? 'Nada pra hoje'
                  : 'Guarde palavras lendo'}
            </span>
          </Link>
        </div>

        {!email && (totalWords > 0 || Object.keys(store.books).length > 0) && (
          <Link to="/ajustes" className="card flex items-center gap-3 p-4 text-ink no-underline">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand text-accent">
              <Cloud />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-[15px] font-semibold">Salve seu progresso</span>
              <span className="text-[13px] text-muted">Entre com seu e-mail para não perder livros e palavras.</span>
            </span>
          </Link>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="m-0 font-display text-xl font-semibold">Sua estante</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {books.map(b => (
              <li key={b.id}>
                <Link to={`/ler/${b.id}`} className="card flex gap-4 p-3.5 text-ink no-underline transition hover:bg-sand">
                  <BookCover book={b} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-sand px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">{LANG_CODE[b.lang]}</span>
                      <span className="text-xs text-muted">{b.level}</span>
                    </div>
                    <div className="font-display text-[17px] leading-tight font-semibold">{b.title_pt}</div>
                    <div className="font-book text-[13px] text-muted">
                      {b.author}, {b.year}
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${pct(b) * 100}%` }} />
                      </span>
                      <span className="w-9 text-right text-xs font-semibold text-muted">{Math.round(pct(b) * 100)}%</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
