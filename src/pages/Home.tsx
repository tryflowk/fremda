import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { BookEntry } from '@/lib/types';
import { LANG_CODE, LANG_NAME, loadCatalog } from '@/lib/books';
import { actions, dueWords, streakOf, today, todayLog, useStore } from '@/lib/store';
import { BookCover } from '@/components/BookCover';
import { Cards, Flame } from '@/components/Icons';

const WEEKDAY = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const GOALS = [10, 15, 25, 40];

export default function Home() {
  const store = useStore();
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-5 pt-7 pb-10">
      <header className="flex items-center justify-between">
        <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-.01em]">Verba</h1>
        <div
          className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 font-semibold text-accent"
          aria-label={`Sequência de ${streak} dias`}
        >
          <Flame size={18} lit={streak > 0} /> {streak} {streak === 1 ? 'dia' : 'dias'}
        </div>
      </header>

      <ol className="m-0 flex list-none justify-between p-0" aria-label="Sua semana de leitura">
        {week.map(d => (
          <li key={d.date} className="flex flex-col items-center gap-1.5">
            <span className={`text-xs font-semibold ${d.isToday ? 'text-ink' : 'text-muted'}`}>{d.label}</span>
            <span
              className={`h-[34px] w-[34px] rounded-full border-2 ${
                d.read ? 'border-accent bg-ember' : d.isToday ? 'border-dashed border-accent' : 'border-line'
              }`}
              aria-label={d.read ? 'leu neste dia' : 'sem leitura'}
            />
          </li>
        ))}
      </ol>

      {current && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 rounded-3xl bg-ink p-5 text-paper"
        >
          <div className="flex items-start gap-4">
            <BookCover book={current} size="sm" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="eyebrow text-peach">
                {store.books[current.id] ? 'Continue lendo' : 'Comece por aqui'} · {LANG_NAME[current.lang]}
              </div>
              <h2 className="m-0 font-display text-[21px] leading-[1.2] font-semibold">{current.title_pt}</h2>
              <p className="m-0 font-book text-sm leading-snug text-[#CFC5B6]">
                {store.books[current.id] ? `${Math.round(pct(current) * 100)}% lido` : current.blurb}
              </p>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-2">
            <div className="h-full rounded-full bg-peach" style={{ width: `${Math.max(pct(current), 0.02) * 100}%` }} />
          </div>
          <Link
            to={`/ler/${current.id}`}
            className="flex h-[52px] items-center justify-center rounded-full bg-accent text-[17px] font-semibold text-white no-underline shadow-[0_4px_0_rgba(0,0,0,.35)] active:translate-y-[2px]"
          >
            {store.books[current.id] ? 'Continuar lendo' : 'Começar a ler'}
          </Link>
        </motion.section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          className="card flex flex-col gap-2 p-4 text-left"
          onClick={() => actions.setGoal(GOALS[(GOALS.indexOf(store.goal) + 1) % GOALS.length])}
          aria-label={`Meta de hoje: ${todays.sentences} de ${store.goal} frases. Toque para mudar a meta.`}
        >
          <span className="text-[13px] font-semibold text-muted">Meta de hoje</span>
          <span className="flex items-baseline gap-1">
            <span className="font-display text-[30px] font-semibold">{todays.sentences}</span>
            <span className="text-muted">/ {store.goal} frases</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-track">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${Math.min(1, todays.sentences / store.goal) * 100}%` }}
            />
          </span>
        </button>
        <Link to="/revisar" className="card flex flex-col gap-2 p-4 text-ink no-underline">
          <span className="flex items-center justify-between text-[13px] font-semibold text-muted">
            Revisar palavras <Cards size={18} />
          </span>
          <span className="flex items-baseline gap-1">
            <span className="font-display text-[30px] font-semibold">{due.length}</span>
            <span className="text-muted">{due.length === 1 ? 'pronta' : 'prontas'}</span>
          </span>
          <span className="truncate font-book text-sm text-ink-2">
            {due.length
              ? due.slice(0, 3).map(w => w.token).join(', ')
              : totalWords
                ? 'Nada pra hoje'
                : 'Guarde palavras lendo'}
          </span>
        </Link>
      </div>

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
  );
}
