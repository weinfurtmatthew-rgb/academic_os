import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifestOf, planMerge, recordsToSend, tombKey, type Records, type Side } from '../src/lib/sync/merge.ts';

const T = (n: number) => new Date(Date.UTC(2026, 9, 1, 12, 0, n)).toISOString();
const rec = (id: string, at?: number, extra: object = {}) => ({ id, ...(at === undefined ? {} : { updatedAt: T(at) }), ...extra });
const tomb = (store: string, id: string, at: number) => ({ key: tombKey(store, id), store, id, deletedAt: T(at) });
const side = (records: Records, tombstones: Side['tombstones'] = []): Side => ({ records, tombstones });

test('takes records it has never seen', () => {
  const plan = planMerge(side({ notes: [] }), side({ notes: [rec('a', 1)] }));
  assert.deepEqual(plan.put.notes.map((r) => r.id), ['a']);
});

test('newer edit wins, older and equal edits are ignored', () => {
  const local = side({ notes: [rec('new', 5), rec('old', 5), rec('tie', 5)] });
  const remote = side({ notes: [rec('new', 6, { v: 'remote' }), rec('old', 4), rec('tie', 5, { v: 'remote' })] });
  assert.deepEqual(planMerge(local, remote).put.notes.map((r) => r.id), ['new']);
});

test('a deletion removes copies edited before it', () => {
  const plan = planMerge(side({ notes: [rec('a', 1)] }), side({ notes: [] }, [tomb('notes', 'a', 2)]));
  assert.deepEqual(plan.del, [{ store: 'notes', id: 'a' }]);
  assert.equal(plan.tombstones.length, 1);
});

test('an edit made after a deletion survives it', () => {
  const plan = planMerge(side({ notes: [rec('a', 3)] }), side({ notes: [] }, [tomb('notes', 'a', 2)]));
  assert.deepEqual(plan.del, []);
});

test('a local deletion keeps older copies from coming back', () => {
  const plan = planMerge(side({ notes: [] }, [tomb('notes', 'a', 5)]), side({ notes: [rec('a', 4)] }));
  assert.equal(plan.put.notes, undefined);
});

test('an edit newer than a local deletion brings the record back', () => {
  const plan = planMerge(side({ notes: [] }, [tomb('notes', 'a', 5)]), side({ notes: [rec('a', 6)] }));
  assert.deepEqual(plan.put.notes.map((r) => r.id), ['a']);
});

test('records from before change tracking: added when missing, never overwrite', () => {
  const plan = planMerge(
    side({ courses: [rec('kept')] }),
    side({ courses: [rec('kept', undefined, { v: 'remote' }), rec('added')] }),
  );
  assert.deepEqual(plan.put.courses.map((r) => r.id), ['added']);
  assert.deepEqual(planMerge(side({ courses: [rec('x')] }), side({ courses: [] }, [tomb('courses', 'x', 1)])).del, [
    { store: 'courses', id: 'x' },
  ]);
});

test('only newer tombstones are stored', () => {
  const plan = planMerge(
    side({}, [tomb('notes', 'a', 5), tomb('notes', 'b', 1)]),
    side({}, [tomb('notes', 'a', 4), tomb('notes', 'b', 2)]),
  );
  assert.deepEqual(plan.tombstones.map((t) => t.id), ['b']);
});

test('a sender holding both a record and a newer deletion of it is not believed', () => {
  const plan = planMerge(side({ notes: [] }), side({ notes: [rec('a', 1)] }, [tomb('notes', 'a', 2)]));
  assert.equal(plan.put.notes, undefined);
});

test('sending only what the peer would take gives the same result as sending everything', () => {
  let seed = 7;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % n);
  const randomSide = (): Side => {
    const records: Records = { notes: [], courses: [] };
    const tombstones: Side['tombstones'] = [];
    for (const store of ['notes', 'courses']) {
      for (let i = 0; i < 12; i++) {
        const roll = rnd(4);
        if (roll === 0) continue;
        if (roll === 1) tombstones.push(tomb(store, `r${i}`, rnd(10)));
        else records[store].push(rec(`r${i}`, rnd(3) === 0 ? undefined : rnd(10)));
      }
    }
    return side(records, tombstones);
  };
  for (let round = 0; round < 300; round++) {
    const a = randomSide();
    const b = randomSide();
    const sent = recordsToSend(a.records, manifestOf(b.records), b.tombstones);
    assert.deepEqual(planMerge(b, side(sent, a.tombstones)), planMerge(b, a), `round ${round}`);
    // and nothing is sent that the peer would then throw away
    const count = (r: Records) => Object.values(r).reduce((n, l) => n + l.length, 0);
    assert.equal(count(planMerge(b, side(sent, [])).put), count(sent), `round ${round}`);
  }
});
