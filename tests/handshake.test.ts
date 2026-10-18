import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHandshake, encodeHandshake, parseHandshakeText } from '../src/lib/sync/handshake.ts';

const FP = Array.from({ length: 32 }, (_, i) => ((i * 37 + 11) & 0xff).toString(16).padStart(2, '0').toUpperCase()).join(':');

// shaped like Chrome's (captured from Chromium)
const CHROME_OFFER = [
  'v=0', 'o=- 1695613764427615913 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=extmap-allow-mixed',
  'a=msid-semantic: WMS', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
  'a=candidate:3959457161 1 udp 2113937151 ee37c728-107d-43af-b7f4-29080927fd8f.local 45714 typ host generation 0 network-cost 999',
  'a=candidate:842163049 1 udp 1677729535 198.51.100.23 61002 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999',
  'a=candidate:1 1 tcp 1518280447 192.168.1.4 9 typ host tcptype active generation 0',
  'a=ice-ufrag:ySl1', 'a=ice-pwd:9fi2bpqRo7JulRMDFcZZSpji', 'a=ice-options:trickle', `a=fingerprint:sha-256 ${FP}`,
  'a=setup:actpass', 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144', '',
].join('\r\n');

// shaped like Firefox's: credentials and fingerprint at session level, uppercase transport, IPv6
const FIREFOX_ANSWER = [
  'v=0', 'o=mozilla...THIS_IS_SDPARTA-128.0 5038424410224734410 0 IN IP4 0.0.0.0', 's=-', 't=0 0',
  `a=fingerprint:sha-256 ${FP}`, 'a=group:BUNDLE 0', 'a=ice-options:trickle', 'a=msid-semantic:WMS *',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
  'a=candidate:0 1 UDP 2122252543 0c3a1e2b-1111-2222-3333-444455556666.local 50123 typ host',
  'a=candidate:1 1 UDP 2122187007 2001:db8::7 50124 typ host',
  'a=candidate:2 1 TCP 2105524479 0c3a1e2b-1111-2222-3333-444455556666.local 9 typ host tcptype active',
  'a=sendrecv', 'a=end-of-candidates', 'a=ice-pwd:8f2ad5a6f1b4c6e2b3a7d9e1f0c2b4a6', 'a=ice-ufrag:3c4d1e2f',
  'a=mid:0', 'a=setup:active', 'a=sctp-port:5000', 'a=max-message-size:1073741823', '',
].join('\r\n');

const field = (sdp: string, prefix: string) => sdp.split('\r\n').find((l) => l.startsWith(prefix));
const candidates = (sdp: string) =>
  sdp.split(/\r?\n/).filter((l) => l.startsWith('a=candidate:')).map((l) => {
    const f = l.split(' ');
    return `${f[2].toLowerCase()} ${f[4]} ${f[5]} ${f[7]}`;
  });

for (const [name, kind, sdp] of [['Chrome offer', 'offer', CHROME_OFFER], ['Firefox answer', 'answer', FIREFOX_ANSWER]] as const) {
  test(`${name}: compact code keeps everything the connection needs`, async () => {
    const code = await encodeHandshake(kind, sdp);
    assert.ok(code.length < 200, `code is ${code.length} chars`);
    const out = await decodeHandshake(code);
    assert.equal(out.kind, kind);
    for (const p of ['a=ice-ufrag:', 'a=ice-pwd:', 'a=fingerprint:', 'a=setup:', 'a=mid:']) {
      assert.equal(field(out.sdp, p), field(sdp, p) ?? sdp.split(/\r?\n/).find((l) => l.startsWith(p)), p);
    }
    // UDP candidates survive (TCP ones are dropped: data channels don't need them)
    assert.deepEqual(candidates(out.sdp).sort(), candidates(sdp).filter((c) => c.startsWith('udp')).sort());
  });
}

test('falls back to the full description when the compact form can’t hold it', async () => {
  const odd = CHROME_OFFER.replace(`sha-256 ${FP}`, `sha-384 ${FP}:AA:BB:CC`);
  const out = await decodeHandshake(await encodeHandshake('offer', odd));
  assert.equal(out.sdp, odd);
});

test('rejects malformed codes', async () => {
  await assert.rejects(decodeHandshake('AAAA'));
  await assert.rejects(decodeHandshake('not base64 at all!'));
});

test('reads links, pasted links and bare codes', () => {
  assert.deepEqual(parseHandshakeText('https://x.workers.dev/sync/#o=AbC-_9'), { kind: 'offer', code: 'AbC-_9' });
  assert.deepEqual(parseHandshakeText('  a=Zz09  '), { kind: 'answer', code: 'Zz09' });
  assert.equal(parseHandshakeText('https://example.com/hello'), null);
});
