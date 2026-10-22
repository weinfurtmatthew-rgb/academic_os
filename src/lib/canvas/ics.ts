/*
 * Minimal iCalendar (RFC 5545) reader: just enough for Canvas calendar feeds.
 * Pure, with no browser or app imports, so it runs under plain Node tests.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  url: string;
  /** ISO timestamp of DTSTART. */
  start: string;
  /** DTSTART was a date with no time. */
  allDay: boolean;
}

/** Undo RFC 5545 text escaping. */
function unescapeText(v: string): string {
  return v.replace(/\\([\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** DTSTART value → ISO. UTC ("Z") is exact; floating and TZID times are read as this device's local time. */
function parseDate(value: string, params: Record<string, string>): { iso: string; allDay: boolean } | null {
  const date = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (date || params.VALUE === 'DATE') {
    const m = date ?? value.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    // all-day: treat as due at the end of that day
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59);
    return { iso: d.toISOString(), allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  const t = m[7] === 'Z' ? new Date(Date.UTC(y, mo - 1, d, h, mi, s)) : new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(t.getTime()) ? null : { iso: t.toISOString(), allDay: false };
}

export function parseIcs(text: string): IcsEvent[] {
  // unfold: a line starting with a space or tab continues the one before it
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?.uid && cur.start) {
        events.push({ uid: cur.uid, summary: cur.summary ?? '', description: cur.description ?? '', url: cur.url ?? '', start: cur.start, allDay: !!cur.allDay });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const [name, ...rawParams] = line.slice(0, colon).split(';');
    const value = line.slice(colon + 1);
    const params: Record<string, string> = {};
    for (const p of rawParams) {
      const eq = p.indexOf('=');
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }
    switch (name.toUpperCase()) {
      case 'UID': cur.uid = value.trim(); break;
      case 'SUMMARY': cur.summary = unescapeText(value).trim(); break;
      case 'DESCRIPTION': cur.description = unescapeText(value).trim(); break;
      case 'URL': cur.url = value.trim(); break;
      case 'DTSTART': {
        const d = parseDate(value.trim(), params);
        if (d) {
          cur.start = d.iso;
          cur.allDay = d.allDay;
        }
        break;
      }
    }
  }
  return events;
}
