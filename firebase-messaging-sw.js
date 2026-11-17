// Shows wedding notifications on the guest's phone even when the app is closed.
// (Firebase Cloud Messaging looks for this file at the site root.)
importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js'
);
// Same public web config as js/config.js (these values are meant to be public).
firebase.initializeApp({
  apiKey: 'AIzaSyD3MGepn-9yKsA9FPn_NWVemcIP3IQS6Os',
  authDomain: 'wedding-app-4f970.firebaseapp.com',
  projectId: 'wedding-app-4f970',
  storageBucket: 'wedding-app-4f970.firebasestorage.app',
  messagingSenderId: '742402615844',
  appId: '1:742402615844:web:d0e4633c12a88b9f3586b1',
});
firebase.messaging();   // messages with a `notification` part are shown automatically

// Tapping a notification opens (or focuses) the app.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification?.data?.FCM_MSG?.fcmOptions?.link || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    return open ? open.focus() : clients.openWindow(url);
  }));
});
