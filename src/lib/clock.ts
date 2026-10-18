const KEY = 'academic-os-clock';
const DAY = 86400000;

let last = 0;

function load() {
  if (last || typeof window === 'undefined') return;
  try {
    last = Number(localStorage.getItem(KEY)) || 0;
  } catch {
    /* storage unavailable */
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, String(last));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Timestamp for a change made on this device. Never earlier than any stamp this device has made
 * or received, so an edit made after a sync always beats what the sync brought in, even when the
 * two devices' clocks disagree.
 */
export function stamp(): string {
  load();
  last = Math.max(Date.now(), last + 1);
  persist();
  return new Date(last).toISOString();
}

/** Note a stamp from another device. Stamps more than a day ahead of this clock are ignored. */
export function observe(iso: string | undefined) {
  if (!iso) return;
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t > Date.now() + DAY) return;
  load();
  if (t > last) {
    last = t;
    persist();
  }
}
