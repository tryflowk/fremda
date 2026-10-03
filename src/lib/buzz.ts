/** Light vibration where the phone supports it (Android); a no-op elsewhere. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
