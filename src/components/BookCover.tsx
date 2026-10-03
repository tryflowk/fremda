import type { BookEntry } from '@/lib/types';

/** A cloth-bound cover: spine shadow, a thin gilt frame, the title set in gold. */
export function BookCover({ book, size = 'md' }: { book: BookEntry; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-[104px] w-[76px] text-[11px]' : 'h-[150px] w-[106px] text-[14px]';
  return (
    <div
      className={`${dims} relative flex shrink-0 flex-col overflow-hidden rounded-[4px_10px_10px_4px] shadow-[inset_6px_0_0_rgba(0,0,0,.25),inset_7px_0_0_rgba(255,255,255,.12),0_10px_22px_rgba(28,17,13,.35)]`}
      style={{ background: `linear-gradient(135deg, rgba(255,255,255,.14), transparent 45%, rgba(0,0,0,.18)), ${book.cover}` }}
      aria-hidden="true"
    >
      <div className="absolute inset-[6px] left-[11px] rounded-[2px_6px_6px_2px] border border-[#E9C987]/45" />
      <div className="relative flex flex-1 flex-col items-center justify-between px-2.5 pt-3 pb-2.5 pl-3.5 text-center">
        <div className="font-display leading-[1.15] font-medium text-[#F6DFA8]">{book.title}</div>
        <svg width="10" height="10" viewBox="0 0 24 24" className="text-[#E9C987]/80">
          <path d="M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z" fill="currentColor" />
        </svg>
        <div className="max-w-full truncate text-[8px] tracking-[.1em] text-[#F6DFA8]/75 uppercase">{book.author.split(' ').slice(-1)[0]}</div>
      </div>
    </div>
  );
}
