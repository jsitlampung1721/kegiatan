// ============================================================================
// PORTAL PESERTA — MODULAR & FAST-LOADING ENGINE (JSIT WILAYAH LAMPUNG)
// ============================================================================
const STORAGE_KEY = 'jsit_lampung_events_v3';
const SETTINGS_KEY = 'jsit_lampung_settings_v3';

const DEFAULT_SETTINGS = {
  orgName: 'JSIT Wilayah Lampung',
  orgSub: 'JSIT Wilayah Lampung - Tim Diklat Wilayah Lampung',
  signerName: 'Muslimin, M.Pd.I.,Gr.',
  signerTitle: 'Ketua JSIT Indonesia Wilayah Lampung',
  webhookUrl: ''
};

const DEFAULT_EVENTS = [
  {
    id: 'evt-jsit-001',
    title: 'Bimtek Implementasi Kurikulum Khas JSIT & Pembelajaran Mendalam (Deep Learning)',
    category: 'Bimtek',
    status: 'Buka Pendaftaran',
    dateStart: '2026-11-28',
    dateEnd: '2026-11-29',
    time: '08.00 - 16.00 WIB',
    timeEnd: '16:00',
    mode: 'Offline / Tatap Muka',
    location: 'Aula Islamic Center Rajabasa, Bandar Lampung',
    zoomUrl: 'https://zoom.us/join',
    flyerImg: '',
    quota: 250,
    attendeeCount: 0,
    pin: '',
    speakers: [
      { name: 'Muslimin, M.Pd.I.,Gr.', role: 'Ketua JSIT Indonesia Wilayah Lampung' },
      { name: 'Ust. Rahmat Hidayat, M.Pd.I.', role: 'Tim Pengembang Kurikulum JSIT Pusat' }
    ],
    description: 'Bimbingan teknis intensif bagi Wakil Kepala Sekolah Bidang Kurikulum dan Guru Inti SIT se-Provinsi Lampung dalam merancang modul ajar terpadu berbasis pendekatan Deep Learning dan Standar Mutu Kekhasan JSIT Edisi Terbaru.',
    materials: [
      { id: 'm-101', title: 'Panduan Umum Kekhasan Kurikulum JSIT 2026', type: 'PDF', url: 'https://drive.google.com', desc: 'Dokumen acuan resmi standar mutu pendidikan SIT.' },
      { id: 'm-102', title: 'Slide Materi: Desain Pembelajaran Mendalam (Deep Learning)', type: 'PPTX', url: 'https://drive.google.com', desc: 'Paparan narasumber sesi 1 dan sesi 2.' },
      { id: 'm-103', title: 'Template Modul Ajar & Rubrik Asesmen Terpadu', type: 'DOCX', url: 'https://drive.google.com', desc: 'Format siap edit untuk praktik penyusunan perangkat ajar.' }
    ],
    recordings: [
      { id: 'r-101', title: 'Rekaman Sesi Pleno & Kebijakan Pendidikan JSIT Lampung', platform: 'YouTube', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', notes: 'Pembukaan oleh Ketua Wilayah & pemaparan arah kebijakan 2026.' }
    ],
    certificate: {
      enabled: true,
      releaseMode: 'after_end',
      customEndDate: '2026-11-29',
      customEndTime: '16:00',
      jp: '16 JP',
      prefix: 'SERT-BIMTEK/JSIT-LPG/XI/2026',
      roleLabel: 'Peserta',
      signerName: 'Muslimin, M.Pd.I.,Gr.',
      signerTitle: 'Ketua JSIT Indonesia Wilayah Lampung',
      themeColor: '#1E3A8A',
      customTemplateImg: '',
      hideDefaultChrome: true,
      showCertHeading: false,
      textColor: '#0B1F3A',
      offsetY: 0,
      qrOffsetX: 0,
      qrOffsetY: 0,
      qrScale: 100,
      showScanBg: true,
      signerOffsetX: 0,
      signerOffsetY: 0,
      signerScale: 100,
      showIssuedDate: true
    },
    attendees: []
  }
];

const U = window.JSITUtils;
let eventsData = [];
let attendeesMap = {};
let activeRoomAttendeeUnsub = null;
let settingsData = { ...DEFAULT_SETTINGS };
let activeCategory = 'ALL';
let currentRoomEventId = null;
let activeCertPayload = null;
let isRoomSidebarCollapsed = false;
const STANDARD_CATS = ['seminar', 'webinar', 'pelatihan', 'workshop', 'bimtek'];

function updateSyncPill(status, text) {
  const dot = document.getElementById('cloud-sync-dot');
  const label = document.getElementById('cloud-sync-label');
  if (!dot || !label) return;
  dot.className = `w-2 h-2 rounded-full ${status === 'cloud' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`;
  label.textContent = text;
}

function normalizeEventItem(item) {
  const rawC = item.certificate || item.certConfig || {};
  const c = { ...rawC };
  if (!c.releaseMode) c.releaseMode = c.enabled === false ? 'disabled' : 'after_end';
  if (!c.customEndDate) c.customEndDate = c.endDate || item.dateEnd || item.dateStart;
  if (!c.customEndTime) c.customEndTime = c.endTime || item.timeEnd || U.parseEndTimeFromText(item.time);
  if (!c.roleLabel && c.role) c.roleLabel = c.role;
  if (typeof c.hideDefaultChrome !== 'boolean') c.hideDefaultChrome = c.hideChrome !== false;
  if (typeof c.showCertHeading !== 'boolean') c.showCertHeading = false;
  if (typeof c.qrOffsetX !== 'number') c.qrOffsetX = Number(c.qrX || 0);
  if (typeof c.qrOffsetY !== 'number') c.qrOffsetY = Number(c.qrY || 0);
  if (typeof c.qrScale !== 'number') c.qrScale = Number(c.qrScale || 100);
  if (typeof c.showScanBg !== 'boolean') c.showScanBg = true;
  if (typeof c.signerOffsetX !== 'number') c.signerOffsetX = Number(c.signerX || 0);
  if (typeof c.signerOffsetY !== 'number') c.signerOffsetY = Number(c.signerY || 0);
  if (typeof c.signerScale !== 'number') c.signerScale = Number(c.signerScale || 100);
  if (typeof c.showIssuedDate !== 'boolean') c.showIssuedDate = true;
  item.certificate = c;

  if (typeof item.flyerImg === 'undefined') item.flyerImg = '';
  if (!Array.isArray(item.materials)) item.materials = [];
  if (!Array.isArray(item.recordings)) item.recordings = [];

  // Normalisasi speakers (mendukung array string maupun array object)
  if (Array.isArray(item.speakers)) {
    item.speakers = item.speakers.map(sp => {
      if (typeof sp === 'string') {
        const m = sp.match(/^(.+?)\s*\((.+?)\)$/);
        return m ? { name: m[1].trim(), role: m[2].trim() } : { name: sp, role: 'Narasumber' };
      }
      return sp;
    });
  } else {
    item.speakers = [];
  }

  if (attendeesMap[item.id]) {
    item.attendees = attendeesMap[item.id];
  } else if (!Array.isArray(item.attendees)) {
    item.attendees = [];
  }
  if (typeof item.attendeeCount !== 'number') {
    item.attendeeCount = item.attendees.length;
  }
  return item;
}

function getEffectiveAttendeeCount(ev) {
  if (attendeesMap[ev.id]) return attendeesMap[ev.id].length;
  if (Array.isArray(ev.attendees) && ev.attendees.length > 0) return ev.attendees.length;
  return Number(ev.attendeeCount || 0);
}

function updateHeroPortalStats() {
  const evCountEl = document.getElementById('hero-stat-events');
  const attCountEl = document.getElementById('hero-stat-attendees');
  const resCountEl = document.getElementById('hero-stat-resources');
  const certCountEl = document.getElementById('hero-stat-certs');
  if (evCountEl) evCountEl.textContent = eventsData.length;
  if (attCountEl) attCountEl.textContent = eventsData.reduce((s, e) => s + getEffectiveAttendeeCount(e), 0);
  if (resCountEl) resCountEl.textContent = eventsData.reduce((s, e) => s + (e.materials ? e.materials.length : 0) + (e.recordings ? e.recordings.length : 0), 0);
  if (certCountEl) certCountEl.textContent = eventsData.filter(e => U.isCertificateReleased(e)).length;
}

function refreshAllVisibleViews() {
  applyHeaderSettings();
  updateHeroPortalStats();
  if (!document.getElementById('catalog-page').classList.contains('hidden')) {
    renderEvents();
  }
  if (currentRoomEventId) {
    const activeEv = eventsData.find(e => e.id === currentRoomEventId);
    if (activeEv) refreshActiveRoomHeaderAndPanels(activeEv);
  }
  if (window.location.hash.startsWith('#verifikasi')) {
    renderVerificationPage(window.location.hash);
  }
  if (window.lucide) lucide.createIcons();
}

// Hanya dengarkan sub-koleksi peserta untuk 1 kegiatan yang sedang dibuka (bukan seluruh kegiatan sekaligus!)
function attachSingleRoomAttendeeListener(eventId) {
  if (activeRoomAttendeeUnsub) {
    activeRoomAttendeeUnsub();
    activeRoomAttendeeUnsub = null;
  }
  const fb = window.JSITFirebase;
  if (!fb || !fb.ready || !fb.db || !eventId) return;

  activeRoomAttendeeUnsub = fb.db.collection('events').doc(eventId).collection('attendees')
    .onSnapshot((snap) => {
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      attendeesMap[eventId] = list;
      const ev = eventsData.find(item => item.id === eventId);
      if (ev) {
        ev.attendees = list;
        ev.attendeeCount = list.length;
      }
      refreshAllVisibleViews();
    }, (err) => console.warn('Room attendee listener warning:', err));
}

function loadLocalFallbackData() {
  try {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) settingsData = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
  } catch (e) {}

  try {
    const savedEvents = localStorage.getItem(STORAGE_KEY);
    if (savedEvents) {
      const parsed = JSON.parse(savedEvents);
      eventsData = Array.isArray(parsed) && parsed.length ? parsed.map(normalizeEventItem) : DEFAULT_EVENTS.map(normalizeEventItem);
    } else {
      eventsData = DEFAULT_EVENTS.map(normalizeEventItem);
    }
  } catch (e) {
    eventsData = DEFAULT_EVENTS.map(normalizeEventItem);
  }
  updateSyncPill('local', 'Mode Lokal (Offline)');
  refreshAllVisibleViews();
}

async function initPortalData() {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const certWrapper = document.getElementById('cert-stage-wrapper');
  if (certWrapper && window.ResizeObserver) {
    new ResizeObserver(() => scalePortalCertStage()).observe(certWrapper);
  }

  const fb = window.JSITFirebase.init();

  window.addEventListener('storage', (e) => {
    if (!fb.ready && (e.key === STORAGE_KEY || e.key === SETTINGS_KEY)) {
      loadLocalFallbackData();
    }
  });

  if (fb.ready && fb.db) {
    updateSyncPill('cloud', 'Cloud Live (Firebase)');

    fb.db.collection('settings').doc('global').onSnapshot((doc) => {
      if (doc.exists) {
        settingsData = { ...DEFAULT_SETTINGS, ...doc.data() };
        refreshAllVisibleViews();
      }
    });

    fb.db.collection('events').onSnapshot((snapshot) => {
      if (snapshot.empty) {
        eventsData = DEFAULT_EVENTS.map(normalizeEventItem);
        refreshAllVisibleViews();
        return;
      }
      const freshList = [];
      snapshot.forEach((doc) => {
        freshList.push(normalizeEventItem({ id: doc.id, ...doc.data() }));
      });
      freshList.sort((a, b) => (b.dateStart || '').localeCompare(a.dateStart || ''));
      eventsData = freshList;
      refreshAllVisibleViews();
    }, (err) => {
      console.error('Firestore events error:', err);
      loadLocalFallbackData();
    });

    handleRoutingFromHash();
    return;
  }

  loadLocalFallbackData();
  handleRoutingFromHash();
}

function applyHeaderSettings() {
  const orgNameEl = document.getElementById('nav-org-name');
  const orgSubEl = document.getElementById('nav-org-sub');
  if (orgNameEl) orgNameEl.textContent = settingsData.orgName || DEFAULT_SETTINGS.orgName;
  if (orgSubEl) orgSubEl.textContent = settingsData.orgSub || DEFAULT_SETTINGS.orgSub;
}

function handleRoutingFromHash() {
  const hash = window.location.hash || '';
  if (hash.startsWith('#verifikasi')) {
    renderVerificationPage(hash);
    return;
  }
  if (hash.startsWith('#kegiatan/')) {
    const rawRest = hash.replace('#kegiatan/', '');
    const parts = rawRest.split('/');
    const evId = decodeURIComponent(parts[0] || '');
    const requestedTab = decodeURIComponent(parts[1] || 'info');
    const validTabs = ['info', 'absensi', 'materi', 'rekaman', 'sertifikat'];
    const targetTab = validTabs.includes(requestedTab) ? requestedTab : 'info';

    if (eventsData.some(e => e.id === evId)) {
      openEventRoom(evId, targetTab, false);
    } else {
      setTimeout(() => {
        if (eventsData.some(e => e.id === evId)) {
          openEventRoom(evId, targetTab, false);
        }
      }, 600);
    }
  } else {
    showCatalogHome(null, false);
  }
}

function getStatusBadge(status) {
  if (status === 'Buka Pendaftaran') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Berlangsung') return 'bg-sky-100 text-sky-800 border-sky-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function setCategoryFilter(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    if (btn.dataset.cat === cat) {
      btn.classList.add('bg-blue-600', 'text-white', 'shadow-xs');
      btn.classList.remove('bg-white', 'text-slate-600', 'border', 'border-slate-200');
    } else {
      btn.classList.remove('bg-blue-600', 'text-white', 'shadow-xs');
      btn.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200');
    }
  });
  renderEvents();
}

function renderEvents() {
  updateHeroPortalStats();
  const query = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('status-filter').value;
  const grid = document.getElementById('events-grid');
  const emptyBox = document.getElementById('empty-events');

  const filtered = eventsData.filter(ev => {
    const evCatLower = (ev.category || '').toLowerCase();
    const matchCat = activeCategory === 'ALL' ||
      (activeCategory === 'Lainnya' ? !STANDARD_CATS.includes(evCatLower) : evCatLower === activeCategory.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || ev.status === statusFilter;
    const speakerText = (ev.speakers || []).map(s => `${s.name} ${s.role}`).join(' ').toLowerCase();
    const matchSearch = !query ||
      (ev.title || '').toLowerCase().includes(query) ||
      (ev.location || '').toLowerCase().includes(query) ||
      evCatLower.includes(query) ||
      speakerText.includes(query);
    return matchCat && matchStatus && matchSearch;
  });

  document.getElementById('events-count-label').textContent = `Menampilkan ${filtered.length} kegiatan`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyBox.classList.remove('hidden');
    return;
  }

  emptyBox.classList.add('hidden');
  grid.innerHTML = filtered.map(ev => {
    const attendeeCount = getEffectiveAttendeeCount(ev);
    const matCount = (ev.materials || []).length;
    const recCount = (ev.recordings || []).length;
    const certReleased = U.isCertificateReleased(ev);
    const relDateObj = U.getCertificateReleaseDate(ev);
    const relTimeStr = relDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + relDateObj.toTimeString().slice(0, 5) + ' WIB';
    const safeId = U.escapeHtml(ev.id);
    const hasFlyer = Boolean(ev.flyerImg && ev.flyerImg.trim() !== '');

    return `
      <article class="bg-white rounded-3xl border border-blue-100/90 shadow-xs hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden">
        <div class="bg-gradient-to-r from-navy-900 to-blue-800 px-5 py-4 text-white">
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <span class="px-2.5 py-0.5 rounded-md bg-sky-400/20 border border-sky-300/30 text-sky-200 text-[11px] font-bold tracking-wide uppercase">
              ${U.escapeHtml(ev.category)}
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(ev.status)}">
              ${U.escapeHtml(ev.status)}
            </span>
          </div>
          <h3 onclick="openEventRoom('${safeId}', 'info')" class="cursor-pointer font-display font-bold text-base sm:text-lg leading-snug line-clamp-2 hover:text-sky-300 transition">
            ${U.escapeHtml(ev.title)}
          </h3>
        </div>

        <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0 space-y-2.5 text-xs text-slate-600">
              <div class="flex items-start gap-2.5">
                <i data-lucide="calendar" class="w-4 h-4 text-blue-600 shrink-0 mt-0.5"></i>
                <div>
                  <span class="font-semibold text-slate-900 block">${U.escapeHtml(U.formatDateIndo(ev.dateStart, ev.dateEnd))}</span>
                  <span class="text-slate-500">${U.escapeHtml(ev.time)}</span>
                </div>
              </div>
              <div class="flex items-start gap-2.5">
                <i data-lucide="map-pin" class="w-4 h-4 text-sky-600 shrink-0 mt-0.5"></i>
                <span class="line-clamp-2 font-medium text-slate-700">${U.escapeHtml(ev.location)}</span>
              </div>
              <div class="flex items-center gap-2.5">
                <i data-lucide="users" class="w-4 h-4 text-blue-600 shrink-0"></i>
                <span><strong>${attendeeCount}</strong> / ${U.escapeHtml(ev.quota)} Peserta Hadir</span>
              </div>
              <div class="flex items-center gap-2.5">
                <i data-lucide="award" class="w-4 h-4 text-amber-500 shrink-0"></i>
                <span>E-Sertifikat: <strong>${certReleased ? 'Sudah Rilis (' + U.escapeHtml((ev.certificate && ev.certificate.jp) || '8 JP') + ')' : 'Rilis ' + U.escapeHtml(relTimeStr)}</strong></span>
              </div>
            </div>

            ${hasFlyer ? `
              <div onclick="openCardFlyerLightbox('${safeId}')" title="Klik untuk memperbesar flyer kegiatan" class="w-24 sm:w-[104px] aspect-[3/4] rounded-xl overflow-hidden border border-blue-200 bg-slate-50 shadow-xs shrink-0 cursor-zoom-in group relative">
                <img loading="lazy" decoding="async" src="${U.escapeHtml(U.sanitizeUrl(ev.flyerImg))}" alt="Flyer ${U.escapeHtml(ev.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-navy-950/75 text-white text-[9px] font-bold">Flyer</span>
              </div>
            ` : ''}
          </div>

          <div class="pt-3 border-t border-slate-100 space-y-2">
            <button onclick="openEventRoom('${safeId}', 'info')" class="w-full py-2.5 px-3 rounded-xl bg-navy-900 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs">
              <i data-lucide="door-open" class="w-4 h-4 text-sky-300"></i>
              <span>Masuk Ruang Kegiatan</span>
            </button>
            <div class="grid grid-cols-2 gap-1.5">
              <button onclick="openEventRoom('${safeId}', 'absensi')" class="py-1.5 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-800 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 transition">
                <i data-lucide="clipboard-check" class="w-3.5 h-3.5"></i>
                <span>Daftar Hadir</span>
              </button>
              <button onclick="openEventRoom('${safeId}', 'materi')" class="py-1.5 px-2.5 rounded-lg bg-sky-50 hover:bg-sky-600 text-sky-800 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 transition">
                <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                <span>Materi (${matCount})</span>
              </button>
              <button onclick="openEventRoom('${safeId}', 'rekaman')" class="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 transition">
                <i data-lucide="video" class="w-3.5 h-3.5"></i>
                <span>Rekaman (${recCount})</span>
              </button>
              <button onclick="openEventRoom('${safeId}', 'sertifikat')" class="py-1.5 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 transition">
                <i data-lucide="award" class="w-3.5 h-3.5"></i>
                <span>E-Sertifikat</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openCardFlyerLightbox(eventId) {
  const ev = eventsData.find(item => item.id === eventId);
  if (!ev || !ev.flyerImg) return;
  document.getElementById('flyer-lightbox-title').textContent = `Flyer: ${ev.title}`;
  document.getElementById('flyer-lightbox-img').src = U.sanitizeUrl(ev.flyerImg);
  document.getElementById('flyer-lightbox-modal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function showCatalogHome(e, updateHash = true) {
  if (e) e.preventDefault();
  if (activeRoomAttendeeUnsub) {
    activeRoomAttendeeUnsub();
    activeRoomAttendeeUnsub = null;
  }
  currentRoomEventId = null;
  document.getElementById('event-room-page').classList.add('hidden');
  document.getElementById('verification-page').classList.add('hidden');
  document.getElementById('catalog-page').classList.remove('hidden');
  if (updateHash) history.replaceState(null, '', window.location.pathname + window.location.search);
  renderEvents();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openEventRoom(eventId, initialTab = 'info', updateHash = true) {
  const ev = eventsData.find(item => item.id === eventId);
  if (!ev) return;

  currentRoomEventId = eventId;
  attachSingleRoomAttendeeListener(eventId);

  document.getElementById('catalog-page').classList.add('hidden');
  document.getElementById('verification-page').classList.add('hidden');
  document.getElementById('event-room-page').classList.remove('hidden');
  if (updateHash) {
    const targetHash = initialTab && initialTab !== 'info'
      ? `#kegiatan/${encodeURIComponent(eventId)}/${encodeURIComponent(initialTab)}`
      : `#kegiatan/${encodeURIComponent(eventId)}`;
    history.replaceState(null, '', targetHash);
  }

  refreshActiveRoomHeaderAndPanels(ev);
  document.getElementById('att-success-banner').classList.add('hidden');
  document.getElementById('cert-result-wrapper').classList.add('hidden');
  document.getElementById('cert-not-found').classList.add('hidden');
  document.getElementById('cert-multiple-matches').classList.add('hidden');

  switchRoomTab(initialTab);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function refreshActiveRoomHeaderAndPanels(ev) {
  const relDate = U.getCertificateReleaseDate(ev);
  const relDateFormatted = relDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' pukul ' + relDate.toTimeString().slice(0, 5) + ' WIB';
  const certReleased = U.isCertificateReleased(ev);

  document.getElementById('room-side-cat').textContent = ev.category;
  document.getElementById('room-side-status').textContent = ev.status;
  document.getElementById('room-side-title').textContent = ev.title;
  document.getElementById('room-side-date').querySelector('span').textContent = U.formatDateIndo(ev.dateStart, ev.dateEnd);
  document.getElementById('room-side-jp-label').textContent = `Fasilitas E-Sertifikat: ${(ev.certificate && ev.certificate.jp) || '8 JP'}`;
  document.getElementById('room-side-release-note').textContent = certReleased
    ? 'E-Sertifikat sudah dirilis dan dapat diunduh.'
    : `Otomatis rilis setelah jam kegiatan berakhir (${relDateFormatted}).`;

  document.getElementById('room-banner-cat').textContent = ev.category;
  document.getElementById('room-banner-mode').textContent = ev.mode;
  document.getElementById('room-banner-title').textContent = ev.title;
  document.getElementById('room-banner-meta').textContent = `${U.formatDateIndo(ev.dateStart, ev.dateEnd)} (${ev.time}) • ${ev.location}`;

  const zoomWrap = document.getElementById('room-banner-zoom-wrap');
  zoomWrap.innerHTML = ev.zoomUrl ? `
    <a href="${U.escapeHtml(U.sanitizeUrl(ev.zoomUrl))}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-navy-950 font-extrabold text-xs shadow-md transition">
      <i data-lucide="video" class="w-4 h-4"></i>
      <span>Link Zoom Kegiatan</span>
      <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
    </a>` : '';

  document.getElementById('info-description').textContent = ev.description || 'Tidak ada deskripsi tambahan.';
  document.getElementById('info-schedule').textContent = `${U.formatDateIndo(ev.dateStart, ev.dateEnd)} (${ev.time})`;
  document.getElementById('info-location').textContent = ev.location;

  const speakersEl = document.getElementById('info-speakers');
  speakersEl.innerHTML = (ev.speakers || []).length ? ev.speakers.map(sp => `
    <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
      <div class="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
        ${U.escapeHtml((sp.name || 'N').charAt(0).toUpperCase())}
      </div>
      <div class="min-w-0">
        <div class="font-bold text-xs text-navy-900 truncate">${U.escapeHtml(sp.name)}</div>
        <div class="text-[11px] text-slate-500 truncate">${U.escapeHtml(sp.role || 'Narasumber')}</div>
      </div>
    </div>
  `).join('') : '<p class="text-xs text-slate-400">Informasi narasumber menyusul.</p>';

  const flyerContainer = document.getElementById('info-flyer-container');
  const flyerImgEl = document.getElementById('info-flyer-img');
  if (ev.flyerImg && ev.flyerImg.trim() !== '') {
    flyerImgEl.src = U.sanitizeUrl(ev.flyerImg);
    flyerContainer.classList.remove('hidden');
  } else {
    flyerImgEl.src = '';
    flyerContainer.classList.add('hidden');
  }

  document.getElementById('att-pin-box').classList.toggle('hidden', !(ev.pin && ev.pin.trim() !== ''));
  renderRoomAttendees(ev);

  const matList = document.getElementById('materials-list');
  matList.innerHTML = (ev.materials || []).length ? ev.materials.map(m => `
    <div class="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 hover:bg-blue-50 transition flex items-start justify-between gap-3">
      <div class="space-y-1">
        <span class="inline-block px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">${U.escapeHtml(m.type || 'FILE')}</span>
        <h4 class="font-bold text-sm text-navy-900">${U.escapeHtml(m.title)}</h4>
        <p class="text-xs text-slate-600">${U.escapeHtml(m.desc || '')}</p>
      </div>
      <a href="${U.escapeHtml(U.sanitizeUrl(m.url))}" target="_blank" rel="noopener" class="shrink-0 px-3.5 py-2 rounded-xl bg-navy-900 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition">
        <i data-lucide="download" class="w-3.5 h-3.5"></i>
        <span>Unduh</span>
      </a>
    </div>
  `).join('') : `<div class="col-span-2 text-center py-8 text-sm text-slate-400">Materi kegiatan belum diunggah oleh panitia.</div>`;

  const recList = document.getElementById('recordings-list');
  recList.innerHTML = (ev.recordings || []).length ? ev.recordings.map(r => {
    const ytId = extractYouTubeId(r.url);
    return `
      <div class="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
        ${ytId ? `
          <div class="aspect-video w-full bg-black">
            <iframe loading="lazy" class="w-full h-full" src="https://www.youtube.com/embed/${encodeURIComponent(ytId)}" title="${U.escapeHtml(r.title)}" frameborder="0" allowfullscreen></iframe>
          </div>
        ` : ''}
        <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span class="text-[10px] font-bold uppercase text-sky-700">${U.escapeHtml(r.platform || 'Video')}</span>
            <h4 class="font-bold text-sm text-navy-900">${U.escapeHtml(r.title)}</h4>
            <p class="text-xs text-slate-600 mt-0.5">${U.escapeHtml(r.notes || '')}</p>
          </div>
          <a href="${U.escapeHtml(U.sanitizeUrl(r.url))}" target="_blank" rel="noopener" class="shrink-0 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5">
            <span>Buka Tautan Video</span>
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
          </a>
        </div>
      </div>
    `;
  }).join('') : `<div class="text-center py-8 text-sm text-slate-400">Rekaman video belum tersedia untuk kegiatan ini.</div>`;

  const lockedBox = document.getElementById('cert-locked-box');
  const unlockedBox = document.getElementById('cert-unlocked-box');
  if (certReleased) {
    lockedBox.classList.add('hidden');
    unlockedBox.classList.remove('hidden');
  } else {
    unlockedBox.classList.add('hidden');
    lockedBox.classList.remove('hidden');
    const certCfg = ev.certificate || {};
    if (certCfg.releaseMode === 'disabled' || certCfg.enabled === false) {
      document.getElementById('cert-locked-title').textContent = 'E-Sertifikat Belum Diaktifkan';
      document.getElementById('cert-locked-desc').textContent = 'Panitia penyelenggara belum mengaktifkan penerbitan E-Sertifikat untuk kegiatan ini.';
      document.getElementById('cert-locked-time').textContent = 'Menunggu Konfirmasi Tim Diklat JSIT Lampung';
    } else {
      document.getElementById('cert-locked-title').textContent = 'E-Sertifikat Otomatis Rilis Setelah Kegiatan Berakhir';
      document.getElementById('cert-locked-desc').textContent = 'Demi tertib administrasi pelatihan, E-Sertifikat baru dapat dicek dan diunduh setelah jam berakhirnya kegiatan.';
      document.getElementById('cert-locked-time').textContent = relDateFormatted;
    }
  }
}

function openFlyerLightbox() {
  const ev = eventsData.find(item => item.id === currentRoomEventId);
  if (!ev || !ev.flyerImg) return;
  document.getElementById('flyer-lightbox-title').textContent = `Flyer: ${ev.title}`;
  document.getElementById('flyer-lightbox-img').src = U.sanitizeUrl(ev.flyerImg);
  document.getElementById('flyer-lightbox-modal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeFlyerLightbox() {
  document.getElementById('flyer-lightbox-modal').classList.add('hidden');
}

function toggleRoomSidebar() {
  isRoomSidebarCollapsed = !isRoomSidebarCollapsed;
  const aside = document.getElementById('room-sidebar');
  const infoBox = document.getElementById('room-sidebar-info');
  const footerBox = document.getElementById('room-sidebar-footer');
  const backBtn = document.getElementById('btn-back-catalog-side');
  const labels = document.querySelectorAll('.room-sidebar-label');

  aside.classList.toggle('lg:w-72', !isRoomSidebarCollapsed);
  aside.classList.toggle('lg:w-20', isRoomSidebarCollapsed);
  infoBox.classList.toggle('lg:hidden', isRoomSidebarCollapsed);
  footerBox.classList.toggle('lg:block', !isRoomSidebarCollapsed);
  backBtn.classList.toggle('lg:hidden', isRoomSidebarCollapsed);
  labels.forEach(el => el.classList.toggle('lg:hidden', isRoomSidebarCollapsed));
}

function switchRoomTab(tabName) {
  document.querySelectorAll('.room-nav-btn').forEach(btn => {
    btn.classList.remove('room-nav-active', 'text-white', 'font-bold');
    btn.classList.add('text-blue-200', 'font-semibold');
  });
  const activeBtn = document.getElementById(`room-nav-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('room-nav-active', 'font-bold');
    activeBtn.classList.remove('text-blue-200', 'font-semibold');
  }

  document.querySelectorAll('.room-panel').forEach(p => p.classList.add('hidden'));
  const activePanel = document.getElementById(`room-panel-${tabName}`);
  if (activePanel) activePanel.classList.remove('hidden');

  if (tabName === 'sertifikat') scalePortalCertStage();

  if (currentRoomEventId) {
    const targetHash = tabName && tabName !== 'info'
      ? `#kegiatan/${encodeURIComponent(currentRoomEventId)}/${encodeURIComponent(tabName)}`
      : `#kegiatan/${encodeURIComponent(currentRoomEventId)}`;
    history.replaceState(null, '', targetHash);
  }
  if (window.lucide) lucide.createIcons();
}

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

function renderRoomAttendees(ev) {
  const list = ev.attendees || [];
  const totalCount = getEffectiveAttendeeCount(ev);
  document.getElementById('att-live-count').textContent = `${totalCount} Peserta`;
  const container = document.getElementById('att-live-list');
  if (list.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-xs text-slate-400">Belum ada peserta yang mengisi daftar hadir. Jadilah yang pertama!</div>`;
    return;
  }
  // Render maksimal 100 peserta terbaru di list live agar DOM tetap ringan saat ribuan peserta hadir
  const visibleList = list.slice(0, 100);
  container.innerHTML = visibleList.map((a, idx) => `
    <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="font-bold text-xs text-navy-900 truncate">${list.length - idx}. ${U.escapeHtml(a.name)}</div>
        <div class="text-[11px] text-slate-500 truncate">${U.escapeHtml(a.school)} &bull; ${U.escapeHtml(a.region)}</div>
      </div>
      <span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">Hadir</span>
    </div>
  `).join('');
}

async function submitAttendance(e) {
  e.preventDefault();
  const ev = eventsData.find(item => item.id === currentRoomEventId);
  if (!ev) return;

  if (ev.pin && ev.pin.trim() !== '') {
    const enteredPin = document.getElementById('att-pin').value.trim();
    if (enteredPin !== ev.pin.trim()) {
      alert('Kode PIN presensi salah! Silakan tanyakan kode PIN kepada panitia.');
      return;
    }
  }

  const name = document.getElementById('att-name').value.trim();
  const school = document.getElementById('att-school').value.trim();
  const region = document.getElementById('att-region').value;
  const role = document.getElementById('att-role').value;
  const phone = document.getElementById('att-phone').value.trim();
  const email = document.getElementById('att-email').value.trim();
  if (!name || !school || !phone) return;

  const existingList = ev.attendees || [];
  const normInPhone = U.normalizePhone(phone);
  const isDup = existingList.some(a =>
    (a.name || '').toLowerCase() === name.toLowerCase() &&
    normInPhone.length >= 8 && U.normalizePhone(a.phone) === normInPhone
  );
  if (isDup) {
    alert('Data kehadiran atas nama dan nomor WhatsApp tersebut sudah tercatat pada kegiatan ini.');
    return;
  }

  const btn = document.getElementById('btn-submit-att');
  btn.disabled = true;
  btn.innerHTML = '<span>Menyimpan Kehadiran...</span>';

  const now = new Date();
  const timestamp = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5);
  const attId = 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
  const newAttendee = {
    id: attId,
    name,
    school,
    region,
    role,
    phone,
    email,
    timestamp,
    createdAt: Date.now(),
    verified: true
  };

  const fb = window.JSITFirebase;
  try {
    if (fb.ready && fb.db) {
      const evRef = fb.db.collection('events').doc(ev.id);
      await evRef.collection('attendees').doc(attId).set(newAttendee);
      // Increment penghitung ringan di dokumen event tanpa menulis ulang array besar
      await evRef.update({
        attendeeCount: firebase.firestore.FieldValue.increment(1)
      }).catch(() => {});
    } else {
      if (!ev.attendees) ev.attendees = [];
      ev.attendees.unshift(newAttendee);
      ev.attendeeCount = ev.attendees.length;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsData));
      renderRoomAttendees(ev);
      renderEvents();
    }

    if (settingsData.webhookUrl) {
      fetch(settingsData.webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attendance', eventId: ev.id, eventTitle: ev.title, attendee: newAttendee })
      }).catch(() => {});
    }

    document.getElementById('attendance-form').reset();
    const banner = document.getElementById('att-success-banner');
    const msgEl = document.getElementById('att-success-msg');
    banner.classList.remove('hidden');

    if (U.isCertificateReleased(ev)) {
      msgEl.textContent = `Terima kasih ${name}. Kehadiran Anda telah tercatat dan E-Sertifikat Anda sudah siap diunduh pada menu E-Sertifikat.`;
    } else {
      const relDate = U.getCertificateReleaseDate(ev);
      const relStr = relDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' pukul ' + relDate.toTimeString().slice(0, 5) + ' WIB';
      msgEl.textContent = `Terima kasih ${name}. Kehadiran Anda telah tercatat. E-Sertifikat akan otomatis rilis setelah kegiatan berakhir (${relStr}).`;
    }
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error submitting attendance:', err);
    alert('Gagal menyimpan daftar hadir ke server. Periksa koneksi internet Anda.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i><span>Kirim Daftar Hadir &amp; Catat Kehadiran</span>';
    if (window.lucide) lucide.createIcons();
  }
}

function buildCertificatePayloadForAttendee(ev, attendee, foundIndex, fallbackSeqStr = '') {
  const attendees = ev.attendees || [];
  const seqNum = foundIndex >= 0 && attendees.length > foundIndex
    ? String(attendees.length - foundIndex).padStart(3, '0')
    : (fallbackSeqStr || '001');
  const certCfg = ev.certificate || {};
  const prefix = certCfg.prefix || 'SERT/JSIT-LPG/2026';
  const certNumber = `${seqNum}/${prefix}`;
  const verCode = `JSIT-${ev.id.slice(-3).toUpperCase()}-${seqNum}`;
  const jp = certCfg.jp || '8 JP';
  const roleLabel = certCfg.roleLabel || attendee.role || 'Peserta';
  const signerName = certCfg.signerName || settingsData.signerName || DEFAULT_SETTINGS.signerName;
  const signerTitle = certCfg.signerTitle || settingsData.signerTitle || DEFAULT_SETTINGS.signerTitle;
  const dateRange = U.formatDateIndo(ev.dateStart, ev.dateEnd);
  const issuedDate = U.formatDateIndo(ev.dateEnd || ev.dateStart, '');
  const orgSubText = settingsData.orgSub || DEFAULT_SETTINGS.orgSub;

  const baseUrl = window.location.href.split('#')[0].split('?')[0];
  const verificationUrl = `${baseUrl}#verifikasi?ev=${encodeURIComponent(ev.id)}&at=${encodeURIComponent(attendee.id)}&c=${encodeURIComponent(verCode)}`;

  return {
    certNumber,
    verCode,
    attendeeId: attendee.id,
    eventId: ev.id,
    name: attendee.name,
    school: attendee.school,
    region: attendee.region || 'Provinsi Lampung',
    roleLabel,
    category: ev.category,
    eventTitle: ev.title,
    dateRange,
    jp,
    issuedDate,
    orgSubText,
    signerName,
    signerTitle,
    themeColor: certCfg.themeColor || '#1E3A8A',
    customTemplateImg: certCfg.customTemplateImg || '',
    hideDefaultChrome: certCfg.hideDefaultChrome !== false,
    showCertHeading: certCfg.showCertHeading === true,
    textColor: certCfg.textColor || '#0B1F3A',
    offsetY: Number(certCfg.offsetY || 0),
    qrOffsetX: Number(certCfg.qrOffsetX || 0),
    qrOffsetY: Number(certCfg.qrOffsetY || 0),
    qrScale: Number(certCfg.qrScale || 100),
    showScanBg: certCfg.showScanBg !== false,
    signerOffsetX: Number(certCfg.signerOffsetX || 0),
    signerOffsetY: Number(certCfg.signerOffsetY || 0),
    signerScale: Number(certCfg.signerScale || 100),
    showIssuedDate: certCfg.showIssuedDate !== false,
    verificationUrl,
    qrDataUrl: ''
  };
}

function scalePortalCertStage() {
  const wrapper = document.getElementById('cert-stage-wrapper');
  const stage = document.getElementById('cert-printable-area');
  if (!wrapper || !stage) return;
  const w = wrapper.clientWidth || 835;
  stage.style.transform = `scale(${(w / 1000).toFixed(5)})`;
}

function applyCertificateLayoutStyles(payload) {
  const area = document.getElementById('cert-printable-area');
  const bgImg = document.getElementById('cert-view-bg-img');
  const outerBorder = document.getElementById('cert-view-outer-border');
  const innerFrame = document.getElementById('cert-view-inner-frame');
  const defaultHeader = document.getElementById('cert-view-default-header');
  const dynamicBlock = document.getElementById('cert-view-dynamic-block');
  const certHeading = document.getElementById('cert-view-heading');
  const certNum = document.getElementById('cert-view-number');
  const givenLabel = document.getElementById('cert-view-given-label');
  const ownerNameEl = document.getElementById('cert-view-name');
  const schoolEl = document.getElementById('cert-view-school');
  const descEl = document.getElementById('cert-view-description');
  const signerTitleEl = document.getElementById('cert-view-signer-title');
  const signerNameEl = document.getElementById('cert-view-signer-name');
  const issuedEl = document.getElementById('cert-view-issued');
  const qrBlock = document.getElementById('cert-view-qr-block');
  const qrText = document.getElementById('cert-view-qr-text');
  const qrOrg = document.getElementById('cert-view-qr-org');
  const signerBlock = document.getElementById('cert-view-signer-block');

  if (qrOrg) qrOrg.textContent = payload.orgSubText || DEFAULT_SETTINGS.orgSub;

  if (payload.customTemplateImg) {
    bgImg.src = payload.customTemplateImg;
    bgImg.classList.remove('hidden');
    area.classList.remove('cert-paper');
    area.style.backgroundColor = '#FFFFFF';
    if (payload.hideDefaultChrome) {
      outerBorder.classList.add('hidden');
      innerFrame.classList.add('hidden');
      defaultHeader.classList.add('hidden');
      dynamicBlock.style.top = '165px';
    } else {
      outerBorder.classList.remove('hidden');
      outerBorder.style.borderColor = payload.themeColor;
      innerFrame.classList.remove('hidden');
      defaultHeader.classList.remove('hidden');
      dynamicBlock.style.top = '158px';
    }
    const txtColor = payload.textColor || '#0B1F3A';
    certNum.style.color = txtColor;
    givenLabel.style.color = txtColor;
    ownerNameEl.style.color = txtColor;
    schoolEl.style.color = txtColor;
    descEl.style.color = txtColor;
    signerTitleEl.style.color = txtColor;
    signerNameEl.style.color = txtColor;
    issuedEl.style.color = txtColor;
    dynamicBlock.style.transform = `translateY(${payload.offsetY || 0}px)`;
  } else {
    bgImg.src = '';
    bgImg.classList.add('hidden');
    area.classList.add('cert-paper');
    outerBorder.classList.remove('hidden');
    outerBorder.style.borderColor = payload.themeColor;
    innerFrame.classList.remove('hidden');
    defaultHeader.classList.remove('hidden');
    dynamicBlock.style.top = '158px';
    certNum.style.color = '#475569';
    givenLabel.style.color = '#64748B';
    ownerNameEl.style.color = '#0B1F3A';
    schoolEl.style.color = '#1E40AF';
    descEl.style.color = '#334155';
    signerTitleEl.style.color = '#1E293B';
    signerNameEl.style.color = '#0B1F3A';
    issuedEl.style.color = '#475569';
    dynamicBlock.style.transform = 'translateY(0px)';
  }

  if (certHeading) {
    certHeading.classList.toggle('hidden', !payload.showCertHeading);
    certHeading.style.color = payload.themeColor;
  }

  if (qrBlock) {
    const qX = payload.qrOffsetX || 0;
    const qY = payload.qrOffsetY || 0;
    const qS = (payload.qrScale || 100) / 100;
    qrBlock.style.transform = `translate(${qX}px, ${qY}px) scale(${qS.toFixed(2)})`;
  }
  if (qrText) {
    qrText.className = payload.showScanBg !== false
      ? 'text-[10.5px] text-slate-600 leading-tight bg-white/85 px-2.5 py-1.5 rounded-lg'
      : 'text-[10.5px] text-slate-700 leading-tight px-2.5 py-1.5 rounded-lg';
  }

  if (signerBlock) {
    const sX = payload.signerOffsetX || 0;
    const sY = payload.signerOffsetY || 0;
    const sS = (payload.signerScale || 100) / 100;
    signerBlock.style.transform = `translate(${sX}px, ${sY}px) scale(${sS.toFixed(2)})`;
  }
  if (issuedEl) {
    issuedEl.classList.toggle('hidden', payload.showIssuedDate === false);
  }
  scalePortalCertStage();
}

async function printCertificateA4() {
  const sourceStage = document.getElementById('cert-printable-area');
  if (!sourceStage) return;

  const oldHost = document.getElementById('cert-print-host');
  if (oldHost) oldHost.remove();

  const printHost = document.createElement('div');
  printHost.id = 'cert-print-host';
  printHost.style.cssText = 'display:none; width:297mm; height:210mm; margin:0; padding:0; overflow:hidden; background:#FFFFFF;';

  const clonedStage = sourceStage.cloneNode(true);
  clonedStage.removeAttribute('id');
  clonedStage.style.width = '1000px';
  clonedStage.style.height = '707px';
  clonedStage.style.transformOrigin = 'top left';
  clonedStage.style.transform = 'scale(1.12252)';
  clonedStage.style.position = 'relative';

  printHost.appendChild(clonedStage);
  document.body.appendChild(printHost);

  const imgs = Array.from(printHost.querySelectorAll('img')).filter(img => !img.classList.contains('hidden') && img.src);
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));

  const cleanupPrint = () => {
    const h = document.getElementById('cert-print-host');
    if (h) h.remove();
    window.removeEventListener('afterprint', cleanupPrint);
  };
  window.addEventListener('afterprint', cleanupPrint);
  setTimeout(() => window.print(), 80);
}

function renderCertificateForAttendeeIndex(ev, foundIndex) {
  const attendees = ev.attendees || [];
  const attendee = attendees[foundIndex];
  if (!attendee) return;

  document.getElementById('cert-not-found').classList.add('hidden');
  document.getElementById('cert-multiple-matches').classList.add('hidden');
  const resultBox = document.getElementById('cert-result-wrapper');

  const payload = buildCertificatePayloadForAttendee(ev, attendee, foundIndex);
  const qrUrl = U.generateQrDataUrl(payload.verificationUrl, 360);
  payload.qrDataUrl = qrUrl;
  activeCertPayload = payload;

  document.getElementById('cert-view-number').textContent = `Nomor: ${payload.certNumber}`;
  document.getElementById('cert-view-name').textContent = payload.name;
  document.getElementById('cert-view-school').textContent = `${payload.school} — ${payload.region}`;
  document.getElementById('cert-view-description').innerHTML = `
    Atas partisipasi aktifnya sebagai <strong>${U.escapeHtml(payload.roleLabel)}</strong> dalam kegiatan <strong>${U.escapeHtml(payload.category)}</strong>:<br/>
    <span class="font-display font-extrabold text-[15.5px] block my-1">"${U.escapeHtml(payload.eventTitle)}"</span>
    yang diselenggarakan oleh ${U.escapeHtml(payload.orgSubText)} pada tanggal <strong>${U.escapeHtml(payload.dateRange)}</strong> dengan bobot pelatihan setara <strong>${U.escapeHtml(payload.jp)}</strong>.
  `;
  document.getElementById('cert-view-code').textContent = payload.verCode;
  document.getElementById('cert-view-issued').textContent = `Bandar Lampung, ${payload.issuedDate}`;
  document.getElementById('cert-view-signer-title').textContent = payload.signerTitle;
  document.getElementById('cert-view-signer-name').textContent = payload.signerName;

  const qrImgEl = document.getElementById('cert-qr-img');
  if (qrImgEl) qrImgEl.src = qrUrl;

  resultBox.classList.remove('hidden');
  applyCertificateLayoutStyles(payload);
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function verifyAndGenerateCert(e) {
  e.preventDefault();
  const ev = eventsData.find(item => item.id === currentRoomEventId);
  if (!ev || !U.isCertificateReleased(ev)) return;

  const query = document.getElementById('cert-search-query').value.trim().toLowerCase();
  const qDigits = U.normalizePhone(query);
  const notFoundBox = document.getElementById('cert-not-found');
  const resultBox = document.getElementById('cert-result-wrapper');
  const multiBox = document.getElementById('cert-multiple-matches');
  const multiList = document.getElementById('cert-multiple-matches-list');

  if (query.length < 3) {
    alert('Masukkan minimal 3 huruf nama atau 6 digit nomor WhatsApp Anda.');
    return;
  }

  const attendees = ev.attendees || [];
  const exactIdx = attendees.findIndex(a => {
    const nameExact = (a.name || '').trim().toLowerCase() === query;
    const aDigits = U.normalizePhone(a.phone);
    return nameExact || (qDigits.length >= 8 && aDigits === qDigits);
  });

  if (exactIdx !== -1) {
    renderCertificateForAttendeeIndex(ev, exactIdx);
    return;
  }

  const matchedIndices = [];
  attendees.forEach((a, idx) => {
    const nameMatch = (a.name || '').toLowerCase().includes(query);
    const aDigits = U.normalizePhone(a.phone);
    const phoneMatch = qDigits.length >= 6 && aDigits.includes(qDigits);
    if (nameMatch || phoneMatch) matchedIndices.push(idx);
  });

  if (matchedIndices.length === 0) {
    resultBox.classList.add('hidden');
    multiBox.classList.add('hidden');
    notFoundBox.classList.remove('hidden');
    return;
  }

  if (matchedIndices.length === 1) {
    renderCertificateForAttendeeIndex(ev, matchedIndices[0]);
    return;
  }

  notFoundBox.classList.add('hidden');
  resultBox.classList.add('hidden');
  multiBox.classList.remove('hidden');
  multiList.innerHTML = matchedIndices.map(idx => {
    const a = attendees[idx];
    return `
      <button type="button" onclick="selectMatchedAttendeeCert(${idx})" class="w-full p-2.5 rounded-xl bg-white hover:bg-blue-600 text-navy-900 hover:text-white border border-blue-200 flex items-center justify-between text-left text-xs transition">
        <div>
          <strong class="block">${U.escapeHtml(a.name)}</strong>
          <span class="opacity-80">${U.escapeHtml(a.school || '-')} &bull; ${U.escapeHtml(a.region || '-')}</span>
        </div>
        <span class="font-bold shrink-0">Pilih &rarr;</span>
      </button>
    `;
  }).join('');
}

function selectMatchedAttendeeCert(idx) {
  const ev = eventsData.find(item => item.id === currentRoomEventId);
  if (ev) renderCertificateForAttendeeIndex(ev, idx);
}

function downloadCertificatePNG() {
  if (!activeCertPayload) return;
  const canvas = document.getElementById('hd-cert-canvas');
  window.JSITCertEngine.renderHDCanvas(canvas, activeCertPayload, DEFAULT_SETTINGS.orgSub, (dataUrl) => {
    const link = document.createElement('a');
    link.download = `E-Sertifikat-A4-JSIT-Lampung-${activeCertPayload.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = dataUrl;
    link.click();
  });
}

function openParticipantCertFromVerification(evId, attId, fallbackName) {
  const ev = eventsData.find(e => e.id === evId);
  if (!ev) return;
  openEventRoom(evId, 'sertifikat', true);
  if (!U.isCertificateReleased(ev)) return;

  const trySelect = () => {
    const list = ev.attendees || [];
    let idx = attId ? list.findIndex(a => a.id === attId) : -1;
    if (idx === -1 && fallbackName) {
      idx = list.findIndex(a => (a.name || '').trim().toLowerCase() === fallbackName.trim().toLowerCase());
    }
    if (idx !== -1) {
      const inp = document.getElementById('cert-search-query');
      if (inp) inp.value = list[idx].name || fallbackName || '';
      renderCertificateForAttendeeIndex(ev, idx);
    } else if (fallbackName) {
      const inp = document.getElementById('cert-search-query');
      if (inp) inp.value = fallbackName;
    }
  };
  setTimeout(trySelect, 350);
}

async function renderVerificationPage(hashStr) {
  document.getElementById('catalog-page').classList.add('hidden');
  document.getElementById('event-room-page').classList.add('hidden');
  document.getElementById('verification-page').classList.remove('hidden');

  const queryPart = hashStr.includes('?') ? hashStr.split('?')[1] : '';
  const params = new URLSearchParams(queryPart);
  const certCodeParam = params.get('c') || params.get('cert') || '';
  const evIdParam = params.get('ev') || '';
  const attIdParam = params.get('at') || '';
  const bodyEl = document.getElementById('verification-result-body');

  let matchedEv = evIdParam ? (eventsData.find(e => e.id === evIdParam) || null) : null;
  let matchedAtt = null;
  let matchedIdx = -1;

  if (matchedEv && attIdParam) {
    const list = matchedEv.attendees || [];
    matchedIdx = list.findIndex(a => a.id === attIdParam);
    if (matchedIdx !== -1) matchedAtt = list[matchedIdx];
  }

  const fb = window.JSITFirebase;
  if (!matchedAtt && fb.ready && fb.db && evIdParam && attIdParam) {
    const statusHeading = document.getElementById('ver-status-heading');
    if (statusHeading) statusHeading.textContent = 'Memverifikasi E-Sertifikat...';
    bodyEl.innerHTML = `
      <div class="p-6 text-center text-xs text-slate-500 space-y-2">
        <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="font-semibold text-navy-900">Menghubungkan ke database resmi JSIT Wilayah Lampung...</p>
      </div>
    `;
    try {
      const [evDoc, attDoc] = await Promise.all([
        fb.db.collection('events').doc(evIdParam).get(),
        fb.db.collection('events').doc(evIdParam).collection('attendees').doc(attIdParam).get()
      ]);
      if (evDoc.exists && attDoc.exists) {
        matchedEv = normalizeEventItem({ id: evDoc.id, ...evDoc.data() });
        matchedAtt = { id: attDoc.id, ...attDoc.data() };
        if (!eventsData.some(e => e.id === matchedEv.id)) eventsData.push(matchedEv);
      }
    } catch (err) {
      console.warn('Direct verification lookup warning:', err);
    }
  }

  if (matchedEv && matchedAtt) {
    const fallbackSeq = certCodeParam && certCodeParam.includes('-') ? certCodeParam.split('-').pop() : '001';
    const livePayload = buildCertificatePayloadForAttendee(matchedEv, matchedAtt, matchedIdx, fallbackSeq);

    const statusHeading = document.getElementById('ver-status-heading');
    const statusSubheading = document.getElementById('ver-status-subheading');
    if (statusHeading) statusHeading.textContent = 'E-Sertifikat Terverifikasi Asli';
    if (statusSubheading) statusSubheading.textContent = 'Data peserta terkonfirmasi langsung pada database resmi JSIT Wilayah Lampung';

    const rows = [
      ['Nomor Sertifikat', livePayload.certNumber],
      ['Kode Validasi Barcode', livePayload.verCode],
      ['Nama Pemilik Sertifikat', livePayload.name],
      ['Asal Sekolah / Instansi', livePayload.school],
      ['Kabupaten / Kota', livePayload.region],
      ['Status / Peran', livePayload.roleLabel],
      ['Perihal / Nama Kegiatan', livePayload.eventTitle],
      ['Tanggal Pelaksanaan', livePayload.dateRange],
      ['Bobot Jam Pelajaran (JP)', livePayload.jp],
      ['Instansi Penyelenggara', livePayload.orgSubText],
      ['Penandatangan Resmi', `${livePayload.signerName} - ${livePayload.signerTitle}`]
    ];

    bodyEl.innerHTML = `
      <div class="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center gap-3.5 mb-2">
        <div class="w-11 h-11 rounded-2xl bg-navy-900 text-amber-300 font-display font-extrabold text-base flex items-center justify-center shrink-0">
          ${U.escapeHtml((livePayload.name || 'P').charAt(0).toUpperCase())}
        </div>
        <div class="min-w-0">
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 block">Identitas Pemilik E-Sertifikat</span>
          <h2 class="font-display font-extrabold text-base sm:text-lg text-navy-900 leading-snug">${U.escapeHtml(livePayload.name)}</h2>
          <p class="text-xs text-slate-600 truncate">${U.escapeHtml(livePayload.school)} &bull; ${U.escapeHtml(livePayload.region)}</p>
        </div>
      </div>
    ` + rows.map(([label, val]) => `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2.5 border-b border-slate-100 last:border-b-0">
        <span class="text-xs font-semibold text-slate-500">${U.escapeHtml(label)}</span>
        <span class="text-xs sm:text-sm font-bold text-navy-900 sm:text-right">${U.escapeHtml(val)}</span>
      </div>
    `).join('') + `
      <div class="pt-4 space-y-2.5">
        <button type="button" onclick="openParticipantCertFromVerification('${U.escapeHtml(matchedEv.id)}', '${U.escapeHtml(matchedAtt.id)}', ${JSON.stringify(livePayload.name)})" class="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-sm transition flex items-center justify-center gap-2">
          <i data-lucide="award" class="w-4 h-4 text-amber-300"></i>
          <span>Lihat &amp; Unduh E-Sertifikat Peserta Ini &rarr;</span>
        </button>
        <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5">
          <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600 shrink-0"></i>
          <span>Status Dokumen: <strong>SAH &amp; TERVERIFIKASI</strong> oleh sistem digital JSIT Wilayah Lampung.</span>
        </div>
      </div>
    `;
  } else {
    const statusHeading = document.getElementById('ver-status-heading');
    if (statusHeading) statusHeading.textContent = 'Memeriksa Data E-Sertifikat';
    bodyEl.innerHTML = `
      <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
        <p class="font-bold">Kode Verifikasi: ${U.escapeHtml(certCodeParam || 'Tidak Terbaca')}</p>
        <p>Data sertifikat tidak ditemukan pada tautan ini. Silakan gunakan menu <strong>Cek E-Sertifikat</strong> pada beranda portal untuk mencari nama atau nomor WhatsApp Anda.</p>
      </div>
    `;
  }
  if (window.lucide) lucide.createIcons();
}

function openGlobalCertModal() {
  document.getElementById('global-cert-modal').classList.remove('hidden');
  document.getElementById('global-cert-results').innerHTML = '';
  if (window.lucide) lucide.createIcons();
}

function closeGlobalCertModal() {
  document.getElementById('global-cert-modal').classList.add('hidden');
}

async function searchGlobalCertificates(e) {
  e.preventDefault();
  const q = document.getElementById('global-cert-input').value.trim().toLowerCase();
  const qDigits = U.normalizePhone(q);
  const resBox = document.getElementById('global-cert-results');

  if (q.length < 3) {
    resBox.innerHTML = `<div class="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold">Masukkan minimal 3 karakter nama atau nomor WhatsApp.</div>`;
    return;
  }

  resBox.innerHTML = `<div class="p-3 text-center text-xs text-slate-500">Mencari data kehadiran di seluruh kegiatan...</div>`;

  const fb = window.JSITFirebase;
  if (fb.ready && fb.db) {
    // Muat sub-koleksi peserta yang belum ter-cache hanya saat tombol Cari ditekan
    await Promise.all(eventsData.map(async (ev) => {
      if (!attendeesMap[ev.id] || attendeesMap[ev.id].length === 0) {
        try {
          const snap = await fb.db.collection('events').doc(ev.id).collection('attendees').get();
          const list = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          attendeesMap[ev.id] = list;
          ev.attendees = list;
        } catch (err) {}
      }
    }));
  }

  const matches = [];
  eventsData.forEach(ev => {
    (ev.attendees || []).forEach(att => {
      const nameOk = (att.name || '').toLowerCase().includes(q);
      const aDigits = U.normalizePhone(att.phone);
      const phoneOk = qDigits.length >= 6 && aDigits.includes(qDigits);
      if (nameOk || phoneOk) {
        matches.push({ ev, att, released: U.isCertificateReleased(ev) });
      }
    });
  });

  if (matches.length === 0) {
    resBox.innerHTML = `<div class="p-4 rounded-2xl bg-rose-50 text-rose-700 text-xs font-medium">Tidak ditemukan riwayat kehadiran dengan kata kunci tersebut.</div>`;
    return;
  }

  resBox.innerHTML = matches.map(m => `
    <div class="p-3.5 rounded-2xl border border-blue-100 bg-blue-50/40 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <span class="text-[10px] font-bold uppercase ${m.released ? 'text-emerald-700' : 'text-amber-700'}">
          ${U.escapeHtml(m.ev.category)} &bull; ${m.released ? 'Sertifikat Rilis' : 'Menunggu Rilis'}
        </span>
        <h4 class="font-bold text-xs text-navy-900 truncate">${U.escapeHtml(m.ev.title)}</h4>
        <p class="text-[11px] text-slate-600">Peserta: <strong>${U.escapeHtml(m.att.name)}</strong> (${U.escapeHtml(m.att.school || '-')})</p>
      </div>
      <button onclick="closeGlobalCertModal(); openParticipantCertFromVerification('${U.escapeHtml(m.ev.id)}', '${U.escapeHtml(m.att.id)}', ${JSON.stringify(m.att.name)});" class="shrink-0 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
        Buka
      </button>
    </div>
  `).join('');
}

window.addEventListener('hashchange', handleRoutingFromHash);
window.addEventListener('resize', scalePortalCertStage);
window.addEventListener('DOMContentLoaded', initPortalData);
