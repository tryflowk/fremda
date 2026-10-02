import type { BookEntry } from '@/lib/types';

export function BookCover({ book, size = 'md' }: { book: BookEntry; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-[104px] w-[76px] p-2 text-[11px]' : 'h-[150px] w-[106px] p-2.5 text-[13px]';
  return (
    <div
      className={`${dims} flex shrink-0 flex-col justify-between rounded-[6px_12px_12px_6px] shadow-[inset_5px_0_0_rgba(0,0,0,.22),0_6px_14px_rgba(34,31,27,.14)]`}
      style={{ background: book.cover }}
      aria-hidden="true"
    >
      <div className="font-display leading-[1.15] font-medium text-paper">{book.title}</div>
      <div className="truncate text-[9px] tracking-[.08em] text-paper/80 uppercase">{book.author.split(' ').slice(-1)[0]}</div>
    </div>
  );
}
