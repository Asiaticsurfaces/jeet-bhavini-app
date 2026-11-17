// Sends phone notifications to guests who turned them on in the app (Firestore pushTokens/{uid}).
//  • every new Live update (posts)            → guests of that side
//  • the "Happening now" banner when it changes (config/now)
//  • 30 minutes before each event              → guests of that side who are invited
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

setGlobalOptions({ region: 'asia-south1', maxInstances: 5 });
initializeApp();
const db = getFirestore();
const APP = 'https://jeet-bhavini.in/';

// Does this phone's guest belong to `side` ('all' | 'Groom' | 'Bride')?
const sideOk = (t, side) => !side || side === 'all' || !t.side || t.side === side;

async function send(title, body, pick) {
  const snap = await db.collection('pushTokens').get();
  const list = snap.docs.map(d => ({ ref: d.ref, ...d.data() })).filter(t => t.token && pick(t));
  let sent = 0;
  for (let i = 0; i < list.length; i += 500) {
    const part = list.slice(i, i + 500);
    const res = await getMessaging().sendEachForMulticast({
      tokens: part.map(t => t.token),
      notification: { title, body },
      webpush: {
        notification: { icon: APP + 'assets/icon-192.png', badge: APP + 'assets/icon-192.png', tag: title.slice(0, 40) },
        fcmOptions: { link: APP },
      },
    });
    sent += res.successCount;
    // Phones that uninstalled or turned notifications off: forget them.
    await Promise.all(res.responses.map((r, k) => !r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(r.error?.code || '')
      ? part[k].ref.delete().catch(() => {}) : null));
  }
  console.log(`"${title}" → ${sent}/${list.length} phones`);
  return sent;
}

// New live update from the family panel.
exports.pushPost = onDocumentCreated('posts/{id}', async ev => {
  const p = ev.data?.data(); if (!p?.title) return;
  await send(p.title, p.body || 'Open the app for details', t => sideOk(t, p.side));
});

// "Happening now" banner switched on or its text changed.
exports.pushNow = onDocumentWritten('config/now', async ev => {
  const a = ev.data?.before?.data() || {}, b = ev.data?.after?.data();
  if (!b?.on || !b.text || (a.on && a.text === b.text && a.side === b.side)) return;
  await send('Happening now', b.text, t => sideOk(t, b.side));
});

// 30-minute reminders (checked every 5 minutes, each event sent once).
exports.remindEvents = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' }, async () => {
  const now = Date.now(), events = (await db.collection('events').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  for (const e of events) {
    const mins = (Date.parse(e.start) - now) / 60000;
    if (e.hidden || mins < 20 || mins > 35) continue;
    const log = db.collection('pushLog').doc(`remind-${e.id}`);
    if ((await log.get()).exists) continue;
    await log.set({ at: FieldValue.serverTimestamp(), event: e.name });
    const base = e.of || e.id;
    await send(`${e.name} starts in 30 minutes`, `Please make your way to ${e.venue || 'the venue'}${e.dress ? ` · Dress: ${e.dress}` : ''}`,
      t => sideOk(t, e.side) && !(t.skip || []).includes(base) && !(t.off || []).includes(base));
  }
});
