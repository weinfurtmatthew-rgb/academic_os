import { decodeHandshake, encodeHandshake } from './handshake';

/*
 * A direct device-to-device connection. Nothing is relayed: the STUN server only tells each device
 * its public address (useful when the devices aren't on the same Wi-Fi); data flows peer-to-peer,
 * encrypted by WebRTC.
 */

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];
const GATHER_TIMEOUT_MS = 2500;
const CONNECT_TIMEOUT_MS = 25000;

/** Characters per frame. ≤ 48 KB of UTF-8, under every browser's message size limit. */
const FRAME = 16000;
const HIGH_WATER = 1 << 20;
const LOW_WATER = 1 << 18;

function gathered(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => pc.iceGatheringState === 'complete' && done();
    pc.addEventListener('icegatheringstatechange', check);
    // A slow or blocked STUN server shouldn't hold things up; local candidates arrive first.
    setTimeout(done, GATHER_TIMEOUT_MS);
  });
}

export class ConnectError extends Error {}

export class Peer {
  readonly pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  private channel: RTCDataChannel | null = null;
  private opened: Promise<RTCDataChannel>;
  private resolveOpen!: (dc: RTCDataChannel) => void;
  private rejectOpen!: (e: Error) => void;

  /** True on the device that showed the first code. It speaks first once connected. */
  private constructor(readonly initiator: boolean) {
    this.opened = new Promise((res, rej) => {
      this.resolveOpen = res;
      this.rejectOpen = rej;
    });
    this.opened.catch(() => undefined); // surfaced through connected()
    this.pc.addEventListener('connectionstatechange', () => {
      if (this.pc.connectionState === 'failed') this.rejectOpen(new ConnectError('connection failed'));
    });
  }

  private watch(dc: RTCDataChannel) {
    this.channel = dc;
    dc.binaryType = 'arraybuffer';
    if (dc.readyState === 'open') this.resolveOpen(dc);
    else dc.addEventListener('open', () => this.resolveOpen(dc), { once: true });
  }

  /** First device: returns the code to show. */
  static async start(): Promise<{ peer: Peer; code: string }> {
    const peer = new Peer(true);
    peer.watch(peer.pc.createDataChannel('academic-os-sync', { ordered: true }));
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    await gathered(peer.pc);
    return { peer, code: await encodeHandshake('offer', peer.pc.localDescription!.sdp) };
  }

  /** Second device: takes the first device's code, returns the reply code to show. */
  static async join(offerCode: string): Promise<{ peer: Peer; code: string }> {
    const { kind, sdp } = await decodeHandshake(offerCode);
    if (kind !== 'offer') throw new Error('That code is a reply code. Scan it from the device that started the sync.');
    const peer = new Peer(false);
    peer.pc.addEventListener('datachannel', (e) => peer.watch(e.channel));
    await peer.pc.setRemoteDescription({ type: 'offer', sdp });
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    await gathered(peer.pc);
    return { peer, code: await encodeHandshake('answer', peer.pc.localDescription!.sdp) };
  }

  /** First device: takes the reply code. */
  async finish(answerCode: string) {
    const { kind, sdp } = await decodeHandshake(answerCode);
    if (kind !== 'answer') throw new Error('That’s a start code. Scan the reply code shown on your other device.');
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  /** Resolves once the devices can talk, or fails after `timeoutMs`. */
  connected(timeoutMs = CONNECT_TIMEOUT_MS): Promise<Wire> {
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new ConnectError('timed out')), timeoutMs));
    return Promise.race([this.opened, timeout]).then((dc) => new Wire(dc, this.initiator));
  }

  close() {
    try {
      this.channel?.close();
      this.pc.close();
    } catch {
      /* already closed */
    }
  }
}

/**
 * JSON messages over a data channel, split into frames so a large record (an attached PDF) fits
 * under message size limits, with backpressure so it doesn't flood the send buffer.
 *   M<json>                     whole message
 *   C<id>:<index>:<count>:<part> one frame of a larger message
 */
export class Wire {
  private queue: unknown[] = [];
  private waiting: ((m: unknown) => void)[] = [];
  private failed: Error | null = null;
  private partial = new Map<string, string[]>();
  private nextId = 0;

  constructor(private dc: RTCDataChannel, readonly initiator: boolean) {
    dc.bufferedAmountLowThreshold = LOW_WATER;
    dc.addEventListener('message', (e) => this.onFrame(String(e.data)));
    dc.addEventListener('close', () => this.fail(new ConnectError('The other device disconnected.')));
  }

  private fail(e: Error) {
    if (this.failed) return;
    this.failed = e;
    this.waiting.splice(0).forEach((w) => w(e));
  }

  private onFrame(frame: string) {
    if (frame[0] === 'M') return this.deliver(frame.slice(1));
    if (frame[0] !== 'C') return;
    const [id, i, n] = frame.slice(1).split(':', 3);
    const part = frame.slice(1 + id.length + i.length + n.length + 3);
    const parts = this.partial.get(id) ?? new Array<string>(Number(n));
    parts[Number(i)] = part;
    this.partial.set(id, parts);
    if (parts.filter((p) => p !== undefined).length === parts.length) {
      this.partial.delete(id);
      this.deliver(parts.join(''));
    }
  }

  private deliver(json: string) {
    let msg: unknown;
    try {
      msg = JSON.parse(json);
    } catch {
      return this.fail(new Error('Received a garbled message.'));
    }
    const w = this.waiting.shift();
    if (w) w(msg);
    else this.queue.push(msg);
  }

  private async drain() {
    while (this.dc.bufferedAmount > HIGH_WATER) {
      if (this.dc.readyState !== 'open') throw this.failed ?? new ConnectError('The other device disconnected.');
      await new Promise((r) => {
        this.dc.addEventListener('bufferedamountlow', r, { once: true });
        this.dc.addEventListener('close', r, { once: true });
      });
    }
  }

  async send(msg: unknown) {
    if (this.failed) throw this.failed;
    const json = JSON.stringify(msg);
    if (json.length <= FRAME) {
      await this.drain();
      this.dc.send(`M${json}`);
      return;
    }
    const id = String(this.nextId++);
    const count = Math.ceil(json.length / FRAME);
    for (let i = 0; i < count; i++) {
      await this.drain();
      this.dc.send(`C${id}:${i}:${count}:${json.slice(i * FRAME, (i + 1) * FRAME)}`);
    }
  }

  /** Next message, in order. */
  receive<T>(): Promise<T> {
    if (this.queue.length) return Promise.resolve(this.queue.shift() as T);
    if (this.failed) return Promise.reject(this.failed);
    return new Promise<T>((resolve, reject) =>
      this.waiting.push((m) => (m instanceof Error ? reject(m) : resolve(m as T))),
    );
  }
}
