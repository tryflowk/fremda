import type { Exercise } from './types';

/** Exercise shapes the reader can render; anything else is skipped. */
export function isSupported(ex: Exercise) {
  if (ex.type === 'yes_no') return true;
  if (ex.type === 'word_order') return !!ex.chips?.length;
  return !!ex.options?.length;
}
