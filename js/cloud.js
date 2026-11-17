// Connects the guest app (index.html) to Firebase. Does nothing while
// FIREBASE_CONFIG is null, so the site keeps working as a preview.
import { FIREBASE_CONFIG, STREAM_URL as LIVE_URL } from './config.js';

const V = '10.14.1';
const G = `https://www.gstatic.com/firebasejs/${V}`;

if (FIREBASE_CONFIG) start().catch(e => console.error('Cloud start failed', e));

async function start() {
  const [{ initializeApp }, A, F, S] = await Promise.all([
    import(`${G}/firebase-app.js`),
    import(`${G}/firebase-auth.js`),
    import(`${G}/firebase-firestore.js`),
    import(`${G}/firebase-storage.js`),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const st = S.getStorage(app);
  const { doc, getDoc, getDocs, setDoc, addDoc, updateDoc, collection, query, where, limit, onSnapshot,
          serverTimestamp, increment, arrayUnion, writeBatch, Timestamp } = F;

  const user = await new Promise((res, rej) => {
    const off = A.onAuthStateChanged(auth, u => { if (u) { off(); res(u); } });
    // Only sign in as a guest if nobody is signed in yet (never replace a family member's Google sign-in).
    auth.authStateReady().then(() => auth.currentUser || A.signInAnonymously(auth)).catch(rej);
  });
  const uid = user.uid;
  const W = window;
  // The app's state lives in index.html's top-level `let` variables (ME, POSTS, travel...),
  // which modules can read and assign by name; they are not window properties.
  const me = () => ME || null;
  const who = () => ({ uid, guestId: me()?.id || '', phone: me()?.phone || '', name: me()?.n || 'Guest', room: me()?.room || '' });
  const ms = t => (t && t.toMillis ? t.toMillis() : Date.now());
  const ago = t => {
    const m = Math.round((Date.now() - ms(t)) / 60000);
    if (m < 1) return 'Just now'; if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
    return new Date(ms(t)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  const COLORS = { Food: 'var(--sage)', Shuttle: 'var(--gold)', Ceremony: 'var(--plum)', Info: 'var(--gold)' };
  const byNew = (a, b) => ms(b.createdAt) - ms(a.createdAt);
  const list = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const refresh = what => W.cloudRefresh && W.cloudRefresh(what);

  // Next 9:00 AM IST after now.
  function revealTime() {
    const IST = 5.5 * 3600e3, now = Date.now(), d = new Date(now + IST);
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 9, 0) - IST;
    return Timestamp.fromMillis(t);
  }
  // Shrink to max 2000px JPEG before upload (keeps storage and data use low).
  async function shrink(file) {
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) return { blob: file, w: 3, h: 4 };
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return { blob, w, h };
  }

  const CLOUD = {
    uid,
    // A number the guest saved before (phoneLinks), else a number from the Excel.
    async findGuest(phone) {
      const link = await getDoc(doc(db, 'phoneLinks', phone));
      const id = link.exists() ? link.data().guestId : phone;
      return this.loadGuest(id, phone);
    },
    // First login: search the guest list by name (any word, from 2 letters).
    async searchGuests(text) {
      const words = text.toLowerCase().split(/[^a-z0-9\u0A80-\u0AFF]+/).filter(w => w.length >= 2);
      if (!words.length) return [];
      const key = words.reduce((a, b) => (b.length > a.length ? b : a)).slice(0, 12);
      const s = await getDocs(query(collection(db, 'guestIndex'), where('tokens', 'array-contains', key), limit(20)));
      return s.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(g => !(g.phones || []).length)   // a name someone already registered is not offered again
        .filter(g => words.every(w => g.tokens.some(t => t.startsWith(w.slice(0, 12)))));
    },
    // "Yes, that's me": remember this number for that guest, then open their pass.
    async linkPhone(id, phone) {
      const g = await this.loadGuest(id, phone);
      if (!g) return null;
      // Claim the name and save the number together; refused if someone claimed it first.
      const b = writeBatch(db);
      b.update(doc(db, 'guestIndex', id), { phones: [phone] });
      b.set(doc(db, 'phoneLinks', phone), { guestId: id, name: g.n, at: serverTimestamp() });
      await b.commit();
      return g;
    },
    async loadGuest(id, phone) {
      const snap = await getDoc(doc(db, 'guests', id));
      if (!snap.exists()) return null;
      const g = snap.data();
      const ev = g.events || {};
      return {
        id, n: g.name, phone, room: g.room || null, party: g.people || 1,
        roomWhere: g.roomWhere || '', stayIn: g.stayIn || '', stayOut: g.stayOut || '', roommates: Array.isArray(g.roommates) ? g.roommates : [],
        side: g.side === 'Bride' ? "Bride's side" : g.side === 'Groom' ? "Groom's side" : (g.side || ''),
        sideKey: /bride/i.test(g.side || '') ? 'Bride' : /groom/i.test(g.side || '') ? 'Groom' : '',
        skip: Object.keys(ev).filter(k => ev[k] === false),   // events they're NOT invited to
        lang: g.lang || 'EN',
      };
    },
    onGuest(g) {
      // Tag this device's arrival/rsvp with the guest's name and phone.
      if (travel) this.saveArrival(travel).catch(() => {});
    },
    addTicket: (cat, text) => addDoc(collection(db, 'tickets'), { ...who(), cat, text, status: 'open', createdAt: serverTimestamp() }),
    addLost: (item, where_) => addDoc(collection(db, 'lost'), { ...who(), item, where: where_, status: 'searching', createdAt: serverTimestamp() }),
    addWish: (name, text) => addDoc(collection(db, 'wishes'), { uid, name, text, hidden: false, createdAt: serverTimestamp() }),
    addSong: title => addDoc(collection(db, 'songs'), { uid, title, votes: 1, createdAt: serverTimestamp() }),
    voteSong: id => updateDoc(doc(db, 'songs', id), { votes: increment(1) }),
    saveRsvp: answers => setDoc(doc(db, 'rsvps', uid), { ...who(), answers, updatedAt: serverTimestamp() }),
    saveArrival: t => setDoc(doc(db, 'arrivals', uid), { ...who(), ...t, updatedAt: serverTimestamp() }, { merge: true }),
    async uploadPhoto(file, event) {
      const { blob, w, h } = await shrink(file);
      const path = `photos/${uid}/${Date.now()}.jpg`;
      const r = S.ref(st, path);
      await S.uploadBytes(r, blob, { contentType: 'image/jpeg' });
      const url = await S.getDownloadURL(r);
      await addDoc(collection(db, 'photos'), { uid, name: who().name, event, path, url, w, h, hidden: false,
        source: 'guest', revealAt: revealTime(), createdAt: serverTimestamp() });
    },
  };
  // Desk check-in status for the pass (re-subscribes when the guest changes).
  let ciId = null, ciOff = null;
  CLOUD.watchCheckin = () => {
    const id = me()?.id || null; if (id === ciId) return;
    ciOff?.(); ciOff = null; ciId = id; CHECKIN = null;
    if (id) ciOff = onSnapshot(doc(db, 'checkins', id), s => { CHECKIN = s.exists() ? s.data() : null; refresh('guest'); }, () => {});
  };
  // Face index of photographer photos, for "Find my photos" (read on demand, not live).
  CLOUD.faceIndex = async () => (await getDocs(collection(db, 'faces'))).docs.map(d => ({ id: d.id, f: d.data().f || [] }));
  W.CLOUD = CLOUD;

  // ---- live data → app state ----
  onSnapshot(collection(db, 'posts'), s => {
    POSTS_ALL = list(s).sort(byNew).map(p => ({ t: p.title, b: p.body || '', k: p.kind || '', side: p.side || 'all', ago: ago(p.createdAt), c: COLORS[p.kind] || 'var(--plum)' }));
    refresh('posts');
  });
  onSnapshot(collection(db, 'events'), s => {
    const L = list(s).filter(e => e.start && e.name && !e.hidden);
    if (L.length) { EVENTS = normEvents(L); refresh('events'); }
  });
  onSnapshot(doc(db, 'config', 'now'), s => {
    const n = s.exists() ? s.data() : null;
    NOWS_ALL = n && n.on && n.text ? [{ t: n.text, place: n.place || null, side: n.side || 'all' }] : []; nowI = 0; refresh('now');
  });
  onSnapshot(doc(db, 'config', 'map'), s => {
    const L = s.exists() ? s.data().places : null;
    if (Array.isArray(L) && L.length) { PLACES = L; refresh('map'); }
  });
  onSnapshot(doc(db, 'config', 'contacts'), s => {
    if (s.exists() && Array.isArray(s.data().list)) { CONTACTS = s.data().list.map(c => [c.label, c.phone || '', c.note || '']); refresh('contacts'); }
  });
  onSnapshot(collection(db, 'found'), s => {
    FOUND = list(s).sort(byNew).map(f => [f.item, f.where || '']); refresh('lost');
  });
  onSnapshot(query(collection(db, 'tickets'), where('uid', '==', uid)), s => {
    tickets = list(s).sort(byNew).map(t => ({ id: t.id, cat: t.cat, text: t.text, status: t.status,
      at: new Date(ms(t.createdAt)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }));
    refresh('help');
  });
  onSnapshot(query(collection(db, 'lost'), where('uid', '==', uid)), s => {
    lost = list(s).sort(byNew).map(l => ({ item: l.item, where: l.where, status: l.status })); refresh('lost');
  });
  onSnapshot(collection(db, 'wishes'), s => {
    wishes = list(s).filter(w => !w.hidden).sort(byNew).map(w => ({ n: w.name, w: w.text })); refresh('wishes');
  });
  onSnapshot(collection(db, 'songs'), s => {
    songs = list(s).map(x => ({ id: x.id, s: x.title, v: x.votes || 0 })); refresh('songs');
  });
  onSnapshot(doc(db, 'arrivals', uid), s => {
    if (!s.exists()) return;
    const a = s.data();
    travel = { mode: a.mode, day: a.day, time: a.time, from: a.from || '', people: a.people || 1, leave: a.leave, pickup: !!a.pickup };
    tMode = travel.mode; tPick = travel.pickup;
    DRIVER = a.driver && a.driver.n ? a.driver : null;
    refresh('arrival');
  });
  const toPhoto = p => ({ id: p.id, src: p.url, by: p.uid === uid ? 'You' : (p.source === 'photographer' ? 'Photographer' : p.name || 'Guest'),
    ev: p.event || '', ar: `${p.w || 3}/${p.h || 4}`, mine: p.uid === uid, revealAt: ms(p.revealAt), createdAt: p.createdAt });
  onSnapshot(query(collection(db, 'photos'), where('uid', '==', uid)), s => {
    myPhotos = list(s).sort(byNew).map(toPhoto); refresh('photos');
  });
  onSnapshot(query(collection(db, 'photos'), where('hidden', '==', false)), s => {
    feedPhotos = list(s).sort(byNew).map(toPhoto); refresh('photos');
  });
  setInterval(() => refresh('photos'), 60000); // photos "develop" at 9 AM without a reload

  if (LIVE_URL) { STREAM_URL = LIVE_URL; }
  // Re-check the saved guest against the live list (room changes etc.).
  if (me()?.phone) CLOUD.findGuest(me().phone).then(g => { if (g) { ME = g; store.set('guest', g); refresh('guest'); } }).catch(() => {});
  refresh('all');
}
