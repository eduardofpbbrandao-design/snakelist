// Unit tests for firebase/firestore.rules (Advent Calendar anti-cheat, promotions, payments, the old collections).
// Needs the Firestore emulator (Java) and, in some folder, npm i firebase-tools @firebase/rules-unit-testing firebase@10.
//   cd firebase && NODE_PATH=<that folder>/node_modules npx firebase emulators:exec --only firestore --project demo-snakelist "node ../tests/firestore-rules.test.js"
// The emulator's request.time is the real clock, so to act as "today is door N" the test loads a copy of the
// rules with the Advent dates shifted (only adventFirst/adventEnd and the promo window change - nothing else).
const fs = require('fs'), path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const firebase = require('firebase/compat/app').default || require('firebase/compat/app');
require('firebase/compat/firestore');

const RULES = fs.readFileSync(path.join(__dirname, '..', 'firebase', 'firestore.rules'), 'utf8');
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8181').split(':');
const PROJECT = 'demo-snakelist';
const EV = 'xmas2026';
let env, fails = 0, passes = 0;
const ok = async (p, m) => { try { await p; passes++; console.log('PASS ' + m); } catch (e) { fails++; console.log('FAIL ' + m + ' - ' + e.message); } };

function shifted(todayDoor) {
  // door `todayDoor` is the one whose 24 hours contain "now"
  const n = new Date(), mid = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const first = mid - (todayDoor - 1) * 864e5, end = first + 31 * 864e5;
  const d = (ms) => { const x = new Date(ms); return 'timestamp.date(' + x.getUTCFullYear() + ', ' + (x.getUTCMonth() + 1) + ', ' + x.getUTCDate() + ')'; };
  return RULES.replace('function adventFirst() { return timestamp.date(2026, 12, 1); }', 'function adventFirst() { return ' + d(first) + '; }')
    .replace('function adventEnd() { return timestamp.date(2027, 1, 1); }', 'function adventEnd() { return ' + d(end) + '; }')
    .replace('request.time >= timestamp.date(2027, 8, 21) && request.time < timestamp.date(2027, 8, 28)', 'request.time >= ' + d(mid - 864e5) + ' && request.time < ' + d(mid + 2 * 864e5));
}
async function rulesFor(text) {
  if (!env) env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: text, host, port: +port } });
  else await fetch(`http://${host}:${port}/emulator/v1/projects/${PROJECT}:securityRules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: text }] } }) }).then((r) => { if (!r.ok) throw new Error('rules load ' + r.status); });
}
const db = (uid, claims) => (uid ? env.authenticatedContext(uid, claims || {}) : env.unauthenticatedContext()).firestore();
const ST = () => firebase.firestore.FieldValue.serverTimestamp();

// what the app does (events/advent.js): read the summary, then one batch: door + summary.
// The streak counts every covered door (on its day or by a skip): run = covered doors right before + 1, ahead =
// covered doors right after (both from the summary's mask), and the door earns floor((L+1+R)/3)-floor(L/3)-floor(R/3).
const Z24 = '0'.repeat(24);
const gainOf = (l, r) => Math.floor((l + 1 + r) / 3) - Math.floor(l / 3) - Math.floor(r / 3);
async function claim(f, uid, day, via, over) {
  const sref = f.doc(`eventProgress/${uid}/events/${EV}`);
  let sum = { earned: 0, earnedUsed: 0, subUsed: 0, claimed: 0, mask: Z24 };
  // (the owner may read their own progress, exactly as the app does)
  const s = await f.doc(`eventProgress/${uid}/events/${EV}`).get(); if (s.exists) sum = s.data();
  const m = sum.mask || Z24;
  let l = 0; while (day - 2 - l >= 0 && m[day - 2 - l] === '1') l++;
  let r = 0; while (day + r < 24 && m[day + r] === '1') r++;
  over = Object.assign({ run: l + 1, ahead: r, bonus: !!over && !!over.bonus }, over || {});
  const run = over.run;
  const door = Object.assign({ day, at: ST(), via, run, ahead: over.ahead, bonus: over.bonus }, over.door || {});
  const nm = m.slice(0, day - 1) + '1' + m.slice(day);
  const next = Object.assign({ earned: sum.earned + gainOf(l, r), earnedUsed: sum.earnedUsed + (via === 'skip' ? 1 : 0), subUsed: sum.subUsed + (via === 'sub' ? 1 : 0), claimed: sum.claimed + 1, last: day, at: ST(), mask: nm }, over.sum || {});
  const b = f.batch();
  if (!over.noDoor) b.set(f.doc(`eventProgress/${uid}/events/${EV}/doors/${over.id || day}`), door);
  if (!over.noSum) b.set(sref, next);
  return b.commit();
}

(async () => {
  await rulesFor(shifted(1));
  await env.clearFirestore();
  const A = db('alice');
  console.log('--- today is door 1');
  await ok(assertSucceeds(claim(A, 'alice', 1, 'day')), 'claim door 1 on its day');
  await ok(assertFails(claim(A, 'alice', 1, 'day', { run: 1 })), 'door 1 cannot be claimed twice');
  await ok(assertFails(claim(A, 'alice', 2, 'day')), 'door 2 (future) is refused');
  await ok(assertFails(claim(A, 'alice', 2, 'skip')), 'no free skip yet -> door 2 cannot be opened early');
  await ok(assertFails(A.doc(`eventProgress/alice/events/${EV}/doors/1`).delete()), 'a door cannot be deleted');
  await ok(assertFails(A.doc(`eventProgress/alice/events/${EV}/doors/1`).update({ via: 'day' })), 'a door cannot be changed');
  await ok(assertFails(A.doc(`eventProgress/alice/events/${EV}`).set({ earned: 9, earnedUsed: 0, subUsed: 0, claimed: 1, last: 1, at: ST() })), 'summary alone (skips out of thin air) is refused');
  await ok(assertSucceeds(A.doc(`eventProgress/alice/events/${EV}/doors/1`).get()), 'owner reads own doors');
  await ok(assertFails(db('mallory').doc(`eventProgress/alice/events/${EV}/doors/1`).get()), 'another account cannot read them');
  await ok(assertFails(db(null).doc(`eventProgress/alice/events/${EV}`).get()), 'signed-out cannot read them');

  await rulesFor(shifted(2));
  console.log('--- today is door 2');
  await ok(assertFails(claim(A, 'alice', 2, 'day', { door: { at: firebase.firestore.Timestamp.fromMillis(Date.now()) }, sum: {} })), 'device time instead of server time is refused');
  await ok(assertFails(claim(A, 'alice', 2, 'day', { run: 5 })), 'a made-up streak run is refused');
  await ok(assertFails(claim(A, 'alice', 2, 'day', { noSum: true })), 'a door without its summary is refused');
  await ok(assertFails(claim(A, 'alice', 2, 'day', { id: '02' })), 'a door id that is not the plain number is refused');
  await ok(assertSucceeds(claim(A, 'alice', 2, 'day')), 'claim door 2 on its day (run 2)');

  await rulesFor(shifted(3));
  await ok(assertFails(claim(A, 'alice', 3, 'day', { sum: { earned: 0 } })), 'the 3rd day in a row must add the earned skip (not hide it)');
  await ok(assertFails(claim(A, 'alice', 3, 'day', { sum: { earned: 2 } })), '... and cannot add two');
  await ok(assertSucceeds(claim(A, 'alice', 3, 'day')), 'door 3 on its day: 3-day streak earns 1 skip');

  await rulesFor(shifted(5));
  console.log('--- today is door 5 (door 4 was missed)');
  await ok(assertFails(claim(A, 'alice', 4, 'day')), 'a missed door cannot be claimed as on time');
  await ok(assertFails(claim(A, 'alice', 4, 'sub')), 'a subscriber skip without a subscription is refused');
  await ok(assertFails(claim(A, 'alice', 4, 'skip', { run: 1 })), 'a skip\'s door must say exactly how many covered doors are before it (3 -> run 4)');
  await ok(assertFails(claim(A, 'alice', 4, 'skip', { ahead: 1 })), '... and after it (none yet)');
  await ok(assertFails(claim(A, 'alice', 4, 'skip', { bonus: true })), 'no subscriber bonus without a subscription');
  await ok(assertFails(claim(A, 'alice', 4, 'skip', { sum: { mask: '1111' + '1'.repeat(20) } })), 'the covered-doors mask cannot be filled in by hand');
  await ok(assertSucceeds(claim(A, 'alice', 4, 'skip')), 'missed door 4 recovered with the earned skip (run 4: it joins the streak)');
  await ok(assertFails(claim(A, 'alice', 5, 'day', { run: 1 })), 'the recovered door 4 counts for the streak: door 5 must say run 5');
  await ok(assertSucceeds(claim(A, 'alice', 5, 'day')), 'door 5 on its day (5 in a row: still 1 free skip, no second one)');
  await rulesFor(shifted(7));
  await ok(assertSucceeds(claim(A, 'alice', 7, 'day')), 'door 7 on its day');
  await ok(assertFails(claim(A, 'alice', 6, 'skip')), 'no earned skips left -> refused');
  await ok(assertFails(claim(A, 'alice', 6, 'skip', { sum: { earnedUsed: 1 } })), '... even when the counter is not raised');

  console.log('--- subscriber skips (max 10)');
  await rulesFor(shifted(15));
  const C = db('carol', { stripeRole: 'subscriber' });
  await ok(assertFails(claim(C, 'carol', 1, 'sub')), 'a subscriber\'s door must carry its bonus rewards (bonus: true)');
  for (let d = 1; d <= 10; d++) await ok(assertSucceeds(claim(C, 'carol', d, 'sub', { bonus: true })), 'subscriber skip ' + d + ' of 10 (door ' + d + ')');
  await ok(assertFails(claim(C, 'carol', 11, 'sub', { bonus: true })), 'an 11th subscriber skip is refused');
  await ok(assertFails(claim(C, 'carol', 11, 'sub', { bonus: true, sum: { subUsed: 10 } })), '... even with the counter left at 10');
  await ok(assertFails(claim(C, 'carol', 11, 'skip', { bonus: true, sum: { earned: 9 } })), 'covering doors 1-10 earned exactly 3 free skips - not more');
  await ok(assertSucceeds(claim(C, 'carol', 11, 'skip', { bonus: true })), 'doors covered by skips count for the streak: a free skip from doors 1-10 recovers door 11');
  await ok(assertFails(claim(C, 'carol', 16, 'sub', { bonus: true })), 'no subscriber skips left -> an upcoming door is refused too');
  console.log('--- a skip on an upcoming door (reserve, skipCanClaimFuture)');
  const Er = db('erin', { stripeRole: 'subscriber' });
  await ok(assertFails(claim(Er, 'erin', 15, 'sub', { bonus: true })), 'today\'s door is never a skip\'s target');
  await ok(assertSucceeds(claim(Er, 'erin', 18, 'sub', { bonus: true })), 'a subscriber skip reserves upcoming door 18');
  await ok(assertFails(claim(Er, 'erin', 18, 'sub', { bonus: true })), '... once only');
  await ok(assertSucceeds(claim(Er, 'erin', 16, 'sub', { bonus: true })), 'door 16 reserved too');
  await ok(assertFails(claim(Er, 'erin', 17, 'sub', { bonus: true, ahead: 0, run: 1, sum: { earned: 0 } })), 'joining 16 and 18: door 17 must say run 2 / ahead 1 and add the skip it earns');
  await ok(assertSucceeds(claim(Er, 'erin', 17, 'sub', { bonus: true })), 'door 17 joins 16 and 18: 3 in a row earn 1 free skip');
  await rulesFor(shifted(15).replace('function skipFuture() { return true; }', 'function skipFuture() { return false; }'));
  await ok(assertFails(claim(Er, 'erin', 19, 'sub', { bonus: true })), 'with skipFuture() off, upcoming doors stay shut to skips');
  await ok(assertSucceeds(claim(Er, 'erin', 3, 'sub', { bonus: true })), '... while a missed door can still be recovered');
  await rulesFor(shifted(0));
  await ok(assertFails(claim(db('fay', { stripeRole: 'subscriber' }), 'fay', 1, 'sub', { bonus: true })), 'before the calendar starts, no door can be reserved');

  console.log('--- after the event');
  await rulesFor(shifted(40));
  await ok(assertFails(claim(db('dave'), 'dave', 24, 'skip')), 'nothing can be claimed after the event ends');

  console.log('--- payments, promotions, settings, old collections');
  await ok(assertFails(A.doc('customers/alice/subscriptions/s1').set({ status: 'active' })), 'a user cannot give themselves a subscription');
  await ok(assertFails(A.doc('customers/alice').set({ stripeId: 'x' })), 'a user cannot write their customer record');
  await ok(assertSucceeds(A.doc('customers/alice/subscriptions/s1').get()), 'a user can read their own subscriptions');
  await ok(assertFails(db('mallory').doc('customers/alice/subscriptions/s1').get()), 'nobody else can');
  await ok(assertSucceeds(A.collection('customers/alice/checkout_sessions').add({ price: 'price_x' })), 'a user can ask for a checkout session (Stripe extension)');
  await ok(assertSucceeds(A.doc('promoClaims/alice/promos/anniv2027-free').set({ promo: 'anniv2027-free', at: ST(), paidAfter: false })), 'anniversary promo claimed once (in its window)');
  await ok(assertFails(A.doc('promoClaims/alice/promos/anniv2027-free').set({ promo: 'anniv2027-free', at: ST(), paidAfter: false })), '... and never twice');
  await ok(assertFails(db('bob').doc('promoClaims/bob/promos/anniv2027-free').set({ promo: 'anniv2027-free', at: ST(), paidAfter: true })), 'a promo can never be set to turn into a paid plan');
  await rulesFor(RULES);
  await ok(assertFails(db('erin').doc('promoClaims/erin/promos/anniv2027-free').set({ promo: 'anniv2027-free', at: ST(), paidAfter: false })), 'with the real dates the promo cannot be claimed before 21 Aug 2027');
  await ok(assertFails(claim(db('erin'), 'erin', 1, 'day')), 'with the real dates door 1 cannot be claimed before 1 Dec 2026');
  await ok(assertSucceeds(A.doc('prefs/alice').set({ cursor: { colour: 'gold', effect: 'trail' }, updated: ST() })), 'cursor choice saved to the account');
  await ok(assertFails(A.doc('prefs/alice').set({ cursor: {}, subscriber: true })), 'prefs cannot carry anything else');
  await ok(assertSucceeds(A.doc('eventProgress/alice/achievements/x-first').set({ id: 'x-first', event: EV, at: ST() })), 'seasonal achievement kept');
  await ok(assertFails(A.doc('eventProgress/alice/achievements/x-first').set({ id: 'x-first', event: EV, at: ST() })), '... once (no duplicates, no changes)');
  await ok(assertSucceeds(A.doc('lists/alice').set({ s: 1 })), 'saved list still works (lists/{uid})');
  await ok(assertFails(db('mallory').doc('lists/alice').get()), 'saved lists stay private');
  await ok(assertSucceeds(A.collection('cams').add({ uid: 'alice', status: 'pending' })), 'a trail camera can be added (pending)');
  await ok(assertFails(A.collection('cams').add({ uid: 'alice', status: 'ok' })), 'a trail camera cannot approve itself');
  await env.cleanup();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
