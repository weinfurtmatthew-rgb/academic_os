/*
 * Packs a WebRTC offer/answer into a code small enough for an easy-to-scan QR.
 *
 * A data-channel session description is ~600 bytes, but only ~120 bytes of it are specific to
 * this connection: ICE credentials, the DTLS fingerprint and the network candidates. Those are
 * written as compact binary; the other device rebuilds a standard description around them. If a
 * browser produces something this format doesn't cover, the whole description is sent compressed
 * instead (a denser QR, but still works).
 */

export type HandshakeKind = 'offer' | 'answer';

const FORMAT = 1;
const COMPACT = 0;
const FULL = 1; // whole SDP, deflated when the browser supports CompressionStream
const FULL_RAW = 2;

const SETUPS = ['actpass', 'active', 'passive'] as const;
const CAND_TYPES = ['host', 'srflx', 'prflx', 'relay'] as const;
const TYPE_PREF: Record<(typeof CAND_TYPES)[number], number> = { host: 126, prflx: 110, srflx: 100, relay: 0 };
const ADDR_UUID = 0; // mDNS name: <uuid>.local
const ADDR_V4 = 1;
const ADDR_TEXT = 2;
const MAX_CANDIDATES = 8;

interface Candidate {
  type: (typeof CAND_TYPES)[number];
  address: string;
  port: number;
}
interface Essentials {
  setup: (typeof SETUPS)[number];
  mid: string;
  ufrag: string;
  pwd: string;
  fingerprint: Uint8Array; // sha-256
  candidates: Candidate[];
}

/* -------------------------------- SDP <-> essentials -------------------------------- */

function parseSdp(sdp: string): Essentials | null {
  const line = (prefix: string) => sdp.split(/\r?\n/).find((l) => l.startsWith(prefix))?.slice(prefix.length).trim();
  const ufrag = line('a=ice-ufrag:');
  const pwd = line('a=ice-pwd:');
  const fp = line('a=fingerprint:');
  const setup = line('a=setup:') as Essentials['setup'] | undefined;
  const mid = line('a=mid:');
  if (!ufrag || !pwd || !fp || !setup || mid === undefined || !SETUPS.includes(setup)) return null;
  const [algo, hex] = fp.split(/\s+/);
  if (algo.toLowerCase() !== 'sha-256' || !hex) return null;
  const fingerprint = new Uint8Array(hex.split(':').map((h) => parseInt(h, 16)));
  if (fingerprint.length !== 32 || fingerprint.some((b) => Number.isNaN(b))) return null;

  const candidates: Candidate[] = [];
  for (const l of sdp.split(/\r?\n/)) {
    if (!l.startsWith('a=candidate:')) continue;
    // foundation component transport priority address port "typ" type ...
    const f = l.slice('a=candidate:'.length).split(/\s+/);
    const type = f[7] as Candidate['type'];
    if (f[1] !== '1' || f[2].toLowerCase() !== 'udp' || f[6] !== 'typ' || !CAND_TYPES.includes(type)) continue;
    candidates.push({ type, address: f[4], port: Number(f[5]) });
  }
  candidates.sort((a, b) => TYPE_PREF[b.type] - TYPE_PREF[a.type]);
  return { setup, mid, ufrag, pwd, fingerprint, candidates: candidates.slice(0, MAX_CANDIDATES) };
}

function buildSdp(e: Essentials): string {
  const session = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('').replace(/^0/, '1');
  const fp = Array.from(e.fingerprint, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const cands = e.candidates.map((c, i) => {
    const priority = TYPE_PREF[c.type] * 2 ** 24 + (65535 - i) * 2 ** 8 + 255;
    const rel = c.type === 'host' ? '' : ' raddr 0.0.0.0 rport 0';
    return `a=candidate:${i + 1} 1 udp ${priority} ${c.address} ${c.port} typ ${c.type}${rel} generation 0`;
  });
  return [
    'v=0',
    `o=- ${session} 2 IN IP4 127.0.0.1`,
    's=-',
    't=0 0',
    `a=group:BUNDLE ${e.mid}`,
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    ...cands,
    `a=ice-ufrag:${e.ufrag}`,
    `a=ice-pwd:${e.pwd}`,
    'a=ice-options:trickle',
    `a=fingerprint:sha-256 ${fp}`,
    `a=setup:${e.setup}`,
    `a=mid:${e.mid}`,
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    '',
  ].join('\r\n');
}

/* ------------------------------------ bytes ------------------------------------ */

class Writer {
  private bytes: number[] = [];
  u8(n: number) {
    this.bytes.push(n & 0xff);
  }
  u16(n: number) {
    this.u8(n >> 8);
    this.u8(n);
  }
  raw(b: ArrayLike<number>) {
    for (let i = 0; i < b.length; i++) this.u8(b[i]);
  }
  text(s: string) {
    const b = new TextEncoder().encode(s);
    if (b.length > 255) throw new Error('field too long');
    this.u8(b.length);
    this.raw(b);
  }
  done() {
    return new Uint8Array(this.bytes);
  }
}

class Reader {
  private i = 0;
  private b: Uint8Array;
  constructor(b: Uint8Array) {
    this.b = b;
  }
  u8() {
    if (this.i >= this.b.length) throw new Error('truncated');
    return this.b[this.i++];
  }
  u16() {
    return (this.u8() << 8) | this.u8();
  }
  raw(n: number) {
    if (this.i + n > this.b.length) throw new Error('truncated');
    const out = this.b.slice(this.i, this.i + n);
    this.i += n;
    return out;
  }
  text() {
    return new TextDecoder().decode(this.raw(this.u8()));
  }
  rest() {
    return this.raw(this.b.length - this.i);
  }
}

const UUID_LOCAL = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function writeAddress(w: Writer, address: string) {
  const uuid = address.match(UUID_LOCAL);
  const v4 = address.match(IPV4);
  if (uuid) {
    w.u8(ADDR_UUID);
    const hex = uuid.slice(1).join('');
    for (let i = 0; i < 32; i += 2) w.u8(parseInt(hex.slice(i, i + 2), 16));
  } else if (v4) {
    w.u8(ADDR_V4);
    v4.slice(1).forEach((o) => w.u8(Number(o)));
  } else {
    w.u8(ADDR_TEXT);
    w.text(address);
  }
}

function readAddress(r: Reader): string {
  const kind = r.u8();
  if (kind === ADDR_UUID) {
    const h = Array.from(r.raw(16), (b) => b.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`;
  }
  if (kind === ADDR_V4) return Array.from(r.raw(4)).join('.');
  if (kind === ADDR_TEXT) return r.text();
  throw new Error('bad address');
}

function toBase64Url(b: Uint8Array): string {
  let s = '';
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipeThrough(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/* ------------------------------------ public ------------------------------------ */

const KIND_BYTE: Record<HandshakeKind, number> = { offer: 0, answer: 1 };

/** Encode a local description as a compact code (base64url, no prefix). */
export async function encodeHandshake(kind: HandshakeKind, sdp: string): Promise<string> {
  const w = new Writer();
  w.u8(FORMAT);
  w.u8(KIND_BYTE[kind]);
  const e = parseSdp(sdp);
  if (e) {
    w.u8(COMPACT);
    w.u8(SETUPS.indexOf(e.setup));
    w.text(e.mid);
    w.text(e.ufrag);
    w.text(e.pwd);
    w.raw(e.fingerprint);
    w.u8(e.candidates.length);
    for (const c of e.candidates) {
      w.u8(CAND_TYPES.indexOf(c.type));
      writeAddress(w, c.address);
      w.u16(c.port);
    }
  } else if (typeof CompressionStream !== 'undefined') {
    w.u8(FULL);
    w.raw(await pipeThrough(new TextEncoder().encode(sdp), new CompressionStream('deflate-raw')));
  } else {
    w.u8(FULL_RAW);
    w.raw(new TextEncoder().encode(sdp));
  }
  return toBase64Url(w.done());
}

/** Decode a code back into a session description. Throws on anything malformed. */
export async function decodeHandshake(code: string): Promise<{ kind: HandshakeKind; sdp: string }> {
  const r = new Reader(fromBase64Url(code));
  if (r.u8() !== FORMAT) throw new Error('This code is from a different version of Academic OS.');
  const kind = (['offer', 'answer'] as const)[r.u8()];
  if (!kind) throw new Error('bad kind');
  const mode = r.u8();
  if (mode === FULL) {
    return { kind, sdp: new TextDecoder().decode(await pipeThrough(r.rest(), new DecompressionStream('deflate-raw'))) };
  }
  if (mode === FULL_RAW) return { kind, sdp: new TextDecoder().decode(r.rest()) };
  if (mode !== COMPACT) throw new Error('bad mode');
  const setup = SETUPS[r.u8()];
  const mid = r.text();
  const ufrag = r.text();
  const pwd = r.text();
  const fingerprint = r.raw(32);
  const candidates: Candidate[] = [];
  const n = r.u8();
  for (let i = 0; i < n; i++) {
    const type = CAND_TYPES[r.u8()];
    const address = readAddress(r);
    const port = r.u16();
    if (!type) throw new Error('bad candidate');
    candidates.push({ type, address, port });
  }
  if (!setup) throw new Error('bad setup');
  return { kind, sdp: buildSdp({ setup, mid, ufrag, pwd, fingerprint, candidates }) };
}

/* ------------------------------ links shown in the QR ------------------------------ */

/**
 * The QR holds a link to the sync page, so a phone's own camera app can open it too. The code
 * rides in the URL fragment, which browsers never send to the server.
 */
export function handshakeLink(kind: HandshakeKind, code: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/sync/#${kind === 'offer' ? 'o' : 'a'}=${code}`;
}

/** Accepts a scanned link, a pasted link, or a bare `o=…`/`a=…` code. */
export function parseHandshakeText(text: string): { kind: HandshakeKind; code: string } | null {
  const m = text.trim().match(/(?:^|#)([oa])=([A-Za-z0-9_-]+)\s*$/);
  if (!m) return null;
  return { kind: m[1] === 'o' ? 'offer' : 'answer', code: m[2] };
}
