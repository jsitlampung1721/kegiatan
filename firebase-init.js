// ============================================================================
// CORE FIREBASE INIT & OFFLINE CACHE — JSIT LAMPUNG
// ============================================================================
window.JSITFirebase = (function () {
  const state = {
    app: null,
    db: null,
    auth: null,
    storage: null,
    ready: false
  };

  function isConfigured() {
    const cfg = window.FIREBASE_CONFIG || window.JSIT_FIREBASE_CONFIG || window.firebaseConfig;
    return Boolean(
      cfg &&
      cfg.apiKey &&
      !String(cfg.apiKey).includes('ISI_') &&
      !String(cfg.apiKey).includes('GANTI_DENGAN') &&
      cfg.projectId &&
      !String(cfg.projectId).includes('ISI_')
    );
  }

  function init() {
    if (state.ready) return state;
    try {
      const cfg = window.FIREBASE_CONFIG || window.JSIT_FIREBASE_CONFIG || window.firebaseConfig;
      if (window.firebase && isConfigured()) {
        if (!firebase.apps.length) {
          state.app = firebase.initializeApp(cfg);
        } else {
          state.app = firebase.app();
        }
        state.db = firebase.firestore();
        state.auth = firebase.auth();
        if (typeof firebase.storage === 'function') {
          state.storage = firebase.storage();
        }
        // Aktifkan cache lokal IndexedDB agar kunjungan berikutnya terbuka instan
        state.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
        state.ready = true;
      }
    } catch (err) {
      console.warn('Firebase init fallback to local mode:', err);
      state.ready = false;
    }
    return state;
  }

  return {
    init,
    get db() { return state.db; },
    get auth() { return state.auth; },
    get storage() { return state.storage; },
    get ready() { return state.ready; }
  };
})();
