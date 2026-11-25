// ============================================================================
// JS/PORTAL-APP.JS — LOGIKA PORTAL PESERTA (FAST LOADING & LAZY TEMPLATE)
// ============================================================================

(() => {
  const U = window.JSITUtils;

  // State Aplikasi
  let db = null;
  let allEvents = [];
  let activeHomeFilter = 'all';
  let currentEventId = null;
  let currentEventAttendees = [];
  let unsubscribeAttendees = null;
  const certTemplateCache = new Map(); // Cache template sertifikat per eventId
  let lastMatchedAttendee = null;

  // Data contoh jika Firebase belum dikonfigurasi
  const SAMPLE_EVENTS = [
    {
      id: 'sample-rakerwil-2026',
      title: 'Rapat Kerja Wilayah (Rakerwil) JSIT Indonesia Wilayah Lampung 2026',
      category: 'Bidang Organisasi & Kelembagaan',
      startDate: '2026-11-28',
      endDate: '2026-11-29',
      time: '08.00 – 16.00 WIB',
      location: 'Hotel Emersia, Bandar Lampung',
      organizer: 'Pengurus Wilayah JSIT Lampung',
      speakers: 'Ketua Umum JSIT Indonesia & Ketua JSIT Wilayah Lampung',
      description: 'Konsolidasi program strategis seluruh Sekolah Islam Terpadu se-Provinsi Lampung dalam meningkatkan mutu pendidikan karakter dan kepemimpinan sekolah.',
      rundown: '08.00 - 09.00 : Registrasi & Pembukaan\n09.00 - 12.00 : Sidang Pleno Program Kerja\n13.00 - 15.30 : Sidang Komisi Bidang\n15.30 - 16.00 : Penutupan & Doa',
      attendanceMode: 'open',
      certReleaseMode: 'auto',
      certNumberPrefix: '421/JSIT-LPG/XI/2026',
      certSignerName: 'H. Ahmad Muzakki, M.Pd.',
      certSignerRole: 'Ketua JSIT Wilayah Lampung',
      materials: [
        { title: 'Materi Pleno Kebijakan JSIT 2026 (PDF)', url: 'https://jsit-indonesia.com' },
        { title: 'Panduan Sidang Komisi Wilayah', url: 'https://jsit-indonesia.com' }
      ],
      attendeeCount: 142
    }
  ];

  // ==================== INISIALISASI FIREBASE ====================
  function initApp() {
    const badge = document.getElementById('fb-connection-badge');
    const banner = document.getElementById('firebase-config-banner');

    if (U.isFirebaseConfigured() && window.firebase) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(U.getFirebaseConfig());
        }
        db = firebase.firestore();

        // Aktifkan persistence lokal agar kunjungan ulang terbuka instan
        db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

        if (badge) {
          badge.className = 'hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30';
          badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Terhubung Cloud';
        }

        // Listener ringan hanya pada koleksi utama events
        db.collection('events').orderBy('startDate', 'desc').onSnapshot(
          (snap) => {
            allEvents = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            onEventsUpdated();
          },
          (err) => {
            console.warn('Fallback query tanpa orderBy:', err);
            db.collection('events').onSnapshot((snap) => {
              allEvents = snap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
              onEventsUpdated();
            });
          }
        );
      } catch (e) {
        console.error('Firebase init error:', e);
        loadFallbackSample(badge, banner);
      }
    } else {
      loadFallbackSample(badge, banner);
    }

    U.refreshIcons();
  }

  function loadFallbackSample(badge, banner) {
    if (banner) banner.classList.remove('hidden');
    if (badge) {
      badge.className = 'hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30';
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Mode Demo Lokal';
    }
    allEvents = SAMPLE_EVENTS;
    onEventsUpdated();
  }

  function onEventsUpdated() {
    const loader = document.getElementById('home-loading-state');
    if (loader) loader.classList.add('hidden');

    updateHomeStats();
    renderHomeEvents();

    // Cek URL hash jika pengunjung membuka tautan langsung ke kegiatan tertentu (#event=ID)
    if (!currentEventId && window.location.hash.startsWith('#event=')) {
      const targetId = decodeURIComponent(window.location.hash.replace('#event=', ''));
      if (allEvents.some((ev) => ev.id === targetId)) {
        openEventRoom(targetId);
        return;
      }
    }

    if (currentEventId) {
      populateEventRoom(currentEventId);
    }
  }

  // ==================== STATUS KEGIATAN ====================
  function computeEventStatus(ev) {
    if (ev.manualStatus && ['berlangsung', 'mendatang', 'selesai'].includes(ev.manualStatus)) {
      return ev.manualStatus;
    }
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const start = ev.startDate || todayStr;
    const end = ev.endDate || start;

    if (todayStr < start) return 'mendatang';
    if (todayStr > end) return 'selesai';
    return 'berlangsung';
  }

  function getStatusMeta(status) {
    if (status === 'berlangsung') {
      return {
        label: 'Sedang Berlangsung',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-500 animate-pulse'
      };
    }
    if (status === 'mendatang') {
      return {
        label: 'Akan Datang',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500'
      };
    }
    return {
      label: 'Selesai',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      dotClass: 'bg-slate-400'
    };
  }

  // ==================== BERANDA & RENDER KARTU ====================
  function updateHomeStats() {
    let active = 0, upcoming = 0, done = 0;
    allEvents.forEach((ev) => {
      const st = computeEventStatus(ev);
      if (st === 'berlangsung') active++;
      else if (st === 'mendatang') upcoming++;
      else done++;
    });
    document.getElementById('stat-home-total').textContent = allEvents.length;
    document.getElementById('stat-home-active').textContent = active;
    document.getElementById('stat-home-upcoming').textContent = upcoming;
    document.getElementById('stat-home-done').textContent = done;
  }

  window.setHomeFilter = function (filter) {
    activeHomeFilter = filter;
    document.querySelectorAll('.home-filter-btn').forEach((btn) => {
      const isAct = btn.getAttribute('data-home-filter') === filter;
      btn.className = isAct
        ? 'home-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 text-white shadow-sm transition'
        : 'home-filter-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
    });
    renderHomeEvents();
  };

  window.renderHomeEvents = function () {
    const grid = document.getElementById('home-events-grid');
    const empty = document.getElementById('home-empty-state');
    const keyword = (document.getElementById('home-search-input')?.value || '').trim().toLowerCase();

    const filtered = allEvents.filter((ev) => {
      const st = computeEventStatus(ev);
      if (activeHomeFilter !== 'all' && st !== activeHomeFilter) return false;
      if (keyword) {
        const hay = `${ev.title || ''} ${ev.category || ''} ${ev.location || ''}`.toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.classList.add('hidden');
      grid.classList.remove('grid');
      empty.classList.remove('hidden');
      U.refreshIcons();
      return;
    }

    empty.classList.add('hidden');
    grid.classList.remove('hidden');
    grid.classList.add('grid');

    grid.innerHTML = filtered.map((ev) => {
      const st = computeEventStatus(ev);
      const meta = getStatusMeta(st);
      const hasFlyer = Boolean(ev.flyerUrl || ev.flyerDataUrl);
      const flyerSrc = U.sanitizeUrl(ev.flyerUrl || ev.flyerDataUrl);

      return `
        <article onclick="openEventRoom('${U.escapeHtml(ev.id)}')" class="event-card-item group cursor-pointer bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden flex flex-col">
          <div class="relative h-48 bg-gradient-to-br from-navy-900 to-blue-800 overflow-hidden">
            ${
              hasFlyer
                ? `<img src="${flyerSrc}" alt="${U.escapeHtml(ev.title)}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" />`
                : `<div class="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/90">
                     <i data-lucide="calendar-days" class="w-10 h-10 text-sky-300 mb-2"></i>
                     <span class="text-xs font-semibold uppercase tracking-wider text-sky-200">${U.escapeHtml(ev.category || 'Agenda JSIT Lampung')}</span>
                   </div>`
            }
            <div class="absolute top-3 left-3">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm backdrop-blur-md ${meta.badgeClass}">
                <span class="w-1.5 h-1.5 rounded-full ${meta.dotClass}"></span>
                ${meta.label}
              </span>
            </div>
          </div>

          <div class="p-6 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1">
                ${U.escapeHtml(ev.category || 'Kegiatan Wilayah')}
              </p>
              <h3 class="font-display font-bold text-lg text-slate-900 group-hover:text-blue-700 transition line-clamp-2 leading-snug">
                ${U.escapeHtml(ev.title)}
              </h3>
              <div class="mt-3.5 space-y-1.5 text-xs text-slate-600">
                <div class="flex items-center gap-2">
                  <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                  <span>${U.formatDateRange(ev.startDate, ev.endDate)}</span>
                </div>
                <div class="flex items-center gap-2">
                  <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                  <span class="truncate">${U.escapeHtml(ev.location || 'Bandar Lampung')}</span>
                </div>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500">
                Presensi & E-Sertifikat
              </span>
              <span class="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition">
                Masuk Ruang <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
              </span>
            </div>
          </div>
        </article>
      `;
    }).join('');

    U.refreshIcons();
  };

  // ==================== NAVIGASI RUANG KEGIATAN ====================
  window.navigateHome = function () {
    currentEventId = null;
    if (unsubscribeAttendees) {
      unsubscribeAttendees();
      unsubscribeAttendees = null;
    }
    currentEventAttendees = [];
    window.history.replaceState(null, '', '#beranda');

    document.getElementById('view-event-room').classList.add('hidden');
    document.getElementById('view-home').classList.remove('hidden');
    document.getElementById('btn-back-home').classList.add('hidden');
    document.getElementById('btn-back-home').classList.remove('inline-flex');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.openEventRoom = function (eventId) {
    const ev = allEvents.find((item) => item.id === eventId);
    if (!ev) return;

    currentEventId = eventId;
    window.history.replaceState(null, '', `#event=${encodeURIComponent(eventId)}`);

    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-event-room').classList.remove('hidden');
    document.getElementById('btn-back-home').classList.remove('hidden');
    document.getElementById('btn-back-home').classList.add('inline-flex');

    // Reset state form & sertifikat
    document.getElementById('attendance-success-box').classList.add('hidden');
    document.getElementById('attendance-form').classList.remove('hidden');
    document.getElementById('cert-result-wrapper').classList.add('hidden');
    document.getElementById('cert-search-feedback').classList.add('hidden');

    populateEventRoom(eventId);
    attachSingleEventAttendeeListener(eventId);
    switchRoomTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Listener peserta HANYA aktif untuk 1 kegiatan yang sedang dibuka
  function attachSingleEventAttendeeListener(eventId) {
    if (unsubscribeAttendees) {
      unsubscribeAttendees();
      unsubscribeAttendees = null;
    }
    currentEventAttendees = [];

    if (!db || String(eventId).startsWith('sample-')) {
      const localKey = `jsit_local_att_${eventId}`;
      currentEventAttendees = JSON.parse(localStorage.getItem(localKey) || '[]');
      updateAttendeeCountUi();
      return;
    }

    unsubscribeAttendees = db
      .collection('events')
      .doc(eventId)
      .collection('attendees')
      .onSnapshot((snap) => {
        currentEventAttendees = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        updateAttendeeCountUi();
      });
  }

  function updateAttendeeCountUi() {
    const ev = allEvents.find((x) => x.id === currentEventId);
    const count = Math.max(currentEventAttendees.length, Number(ev?.attendeeCount || 0));
    const el = document.getElementById('room-detail-attendee-count');
    if (el) el.textContent = `${count} Peserta`;
  }

  function populateEventRoom(eventId) {
    const ev = allEvents.find((x) => x.id === eventId);
    if (!ev) return;

    const st = computeEventStatus(ev);
    const meta = getStatusMeta(st);

    const statusBadge = document.getElementById('room-status-badge');
    statusBadge.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${meta.badgeClass}`;
    statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${meta.dotClass}"></span> ${meta.label}`;

    document.getElementById('room-category-badge').textContent = ev.category || 'Agenda JSIT Lampung';
    document.getElementById('room-event-title').textContent = ev.title || '-';
    document.getElementById('room-event-date').textContent = U.formatDateRange(ev.startDate, ev.endDate);
    document.getElementById('room-event-time').textContent = ev.time || '08.00 WIB – Selesai';
    document.getElementById('room-event-location').textContent = ev.location || 'Wilayah Lampung';

    // Detail tab
    document.getElementById('room-detail-description').textContent = ev.description || 'Deskripsi lengkap kegiatan belum ditambahkan.';
    document.getElementById('room-detail-speakers').textContent = ev.speakers || 'Tim Pemateri JSIT Wilayah Lampung';
    document.getElementById('room-detail-organizer').textContent = ev.organizer || 'JSIT Wilayah Lampung';
    document.getElementById('room-detail-rundown').textContent = ev.rundown || 'Susunan acara akan diinformasikan oleh panitia pelaksana.';
    updateAttendeeCountUi();

    // Flyer
    const flyerImg = document.getElementById('room-flyer-img');
    const flyerFallback = document.getElementById('room-flyer-fallback');
    const flyerSrc = ev.flyerUrl || ev.flyerDataUrl;
    if (flyerSrc) {
      flyerImg.src = U.sanitizeUrl(flyerSrc);
      flyerImg.classList.remove('hidden');
      flyerFallback.classList.add('hidden');
    } else {
      flyerImg.classList.add('hidden');
      flyerFallback.classList.remove('hidden');
    }

    // Status Presensi (Terbuka / Tertutup)
    const isPresensiOpen = isEventAttendanceOpen(ev);
    const gateBadge = document.getElementById('presensi-gate-badge');
    const closedBox = document.getElementById('presensi-closed-box');
    const formEl = document.getElementById('attendance-form');

    if (isPresensiOpen) {
      gateBadge.className = 'px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800';
      gateBadge.textContent = 'Presensi Dibuka';
      closedBox.classList.add('hidden');
      formEl.classList.remove('hidden');
    } else {
      gateBadge.className = 'px-3 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800';
      gateBadge.textContent = 'Presensi Ditutup';
      closedBox.classList.remove('hidden');
      formEl.classList.add('hidden');
      document.getElementById('presensi-closed-reason').textContent =
        ev.attendanceMode === 'closed'
          ? 'Panitia telah menutup formulir daftar hadir untuk kegiatan ini.'
          : 'Waktu pengisian daftar hadir belum dibuka atau sudah berakhir sesuai jadwal kegiatan.';
    }

    // Cek apakah peserta sudah pernah mengisi presensi di perangkat ini
    const unlockedKey = `jsit_unlocked_${ev.id}`;
    if (localStorage.getItem(unlockedKey) === '1') {
      unlockMaterialsPanel(ev);
    } else {
      document.getElementById('materials-locked-box').classList.remove('hidden');
      document.getElementById('materials-unlocked-list').classList.add('hidden');
    }

    U.refreshIcons();
  }

  function isEventAttendanceOpen(ev) {
    const mode = ev.attendanceMode || 'open';
    if (mode === 'open') return true;
    if (mode === 'closed') return false;
    // Mode 'auto' mengikuti tanggal & jam selesai
    const st = computeEventStatus(ev);
    return st === 'berlangsung';
  }

  window.switchRoomTab = function (tabName) {
    ['detail', 'presensi', 'sertifikat'].forEach((t) => {
      const panel = document.getElementById(`room-panel-${t}`);
      const btn = document.querySelector(`.room-tab-btn[data-room-tab="${t}"]`);
      if (panel) panel.classList.toggle('hidden', t !== tabName);
      if (btn) {
        btn.className = t === tabName
          ? 'room-tab-btn room-nav-active shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition'
          : 'room-tab-btn shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/10 text-slate-200 hover:bg-white/20 transition';
      }
    });
    U.refreshIcons();
  };

  // ==================== SUBMIT PRESENSI & BUKA MATERI ====================
  window.submitAttendance = async function (e) {
    e.preventDefault();
    const ev = allEvents.find((x) => x.id === currentEventId);
    if (!ev) return;

    const btn = document.getElementById('btn-submit-attendance');
    const name = document.getElementById('att-name').value.trim();
    const rawPhone = document.getElementById('att-phone').value.trim();
    const phone = U.normalizePhone(rawPhone);
    const email = document.getElementById('att-email').value.trim();
    const institution = document.getElementById('att-institution').value.trim();
    const role = document.getElementById('att-role').value.trim();
    const city = document.getElementById('att-city').value;

    if (!name || !phone || !institution) return;

    btn.disabled = true;
    btn.innerHTML = '<span>Menyimpan Kehadiran...</span>';

    try {
      const docId = `${phone}_${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;
      const existing = currentEventAttendees.find((a) => U.normalizePhone(a.phone) === phone);
      const seqNumber = existing?.certSeq || (currentEventAttendees.length + 1);

      const payload = {
        name,
        phone,
        email,
        institution,
        role,
        city,
        certSeq: seqNumber,
        submittedAt: new Date().toISOString()
      };

      if (db && !String(ev.id).startsWith('sample-')) {
        await db.collection('events').doc(ev.id).collection('attendees').doc(docId).set(payload, { merge: true });
      } else {
        const localKey = `jsit_local_att_${ev.id}`;
        const list = JSON.parse(localStorage.getItem(localKey) || '[]');
        const idx = list.findIndex((x) => U.normalizePhone(x.phone) === phone);
        if (idx >= 0) list[idx] = payload;
        else list.push(payload);
        localStorage.setItem(localKey, JSON.stringify(list));
        currentEventAttendees = list;
        updateAttendeeCountUi();
      }

      localStorage.setItem(`jsit_unlocked_${ev.id}`, '1');
      document.getElementById('cert-search-query').value = phone;

      document.getElementById('attendance-form').classList.add('hidden');
      document.getElementById('attendance-success-box').classList.remove('hidden');
      document.getElementById('attendance-success-detail').textContent =
        `Data atas nama ${name} (${institution}) telah tersimpan. Tautan materi di sebelah kanan kini sudah terbuka.`;

      unlockMaterialsPanel(ev);
    } catch (err) {
      console.error('Gagal menyimpan presensi:', err);
      alert('Terjadi kendala saat menyimpan daftar hadir. Periksa koneksi internet Anda lalu coba kembali.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check-circle-2" class="w-5 h-5"></i><span>Kirim Daftar Hadir & Buka Akses Materi</span>';
      U.refreshIcons();
    }
  };

  window.resetAttendanceForm = function () {
    document.getElementById('attendance-form').reset();
    document.getElementById('attendance-success-box').classList.add('hidden');
    document.getElementById('attendance-form').classList.remove('hidden');
  };

  function unlockMaterialsPanel(ev) {
    const locked = document.getElementById('materials-locked-box');
    const listEl = document.getElementById('materials-unlocked-list');
    locked.classList.add('hidden');
    listEl.classList.remove('hidden');

    const materials = Array.isArray(ev.materials) ? ev.materials : [];
    if (materials.length === 0) {
      listEl.innerHTML = `
        <div class="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
          Panitia belum menambahkan tautan file materi untuk kegiatan ini.
        </div>`;
      return;
    }

    listEl.innerHTML = materials.map((m, idx) => `
      <a href="${U.sanitizeUrl(m.url)}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition group">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">
            ${idx + 1}
          </div>
          <span class="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-blue-700 truncate">
            ${U.escapeHtml(m.title || 'Unduh Materi Kegiatan')}
          </span>
        </div>
        <i data-lucide="external-link" class="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0"></i>
      </a>
    `).join('');
    U.refreshIcons();
  }

  // ==================== PENCARIAN & RENDER E-SERTIFIKAT ====================
  async function loadEventCertTemplate(eventId, ev) {
    // 1. Jika sudah ada di cache memori
    if (certTemplateCache.has(eventId)) {
      return certTemplateCache.get(eventId);
    }
    // 2. Jika dokumen lama masih menyimpan customTemplateImg langsung
    if (ev.customTemplateImg) {
      certTemplateCache.set(eventId, ev.customTemplateImg);
      return ev.customTemplateImg;
    }
    // 3. Lazy-load dari sub-dokumen privat agar halaman beranda tetap ringan
    if (db && !String(eventId).startsWith('sample-')) {
      try {
        const snap = await db.collection('events').doc(eventId).collection('private').doc('cert_template').get();
        if (snap.exists && snap.data()?.imageDataUrl) {
          const dataUrl = snap.data().imageDataUrl;
          certTemplateCache.set(eventId, dataUrl);
          return dataUrl;
        }
      } catch (e) {
        console.warn('Tidak ada template privat:', e);
      }
    }
    certTemplateCache.set(eventId, null);
    return null;
  }

  window.searchParticipantCertificate = async function (e) {
    e.preventDefault();
    const ev = allEvents.find((x) => x.id === currentEventId);
    if (!ev) return;

    const queryRaw = document.getElementById('cert-search-query').value.trim();
    const queryPhone = U.normalizePhone(queryRaw);
    const queryLower = queryRaw.toLowerCase();

    const feedbackBox = document.getElementById('cert-search-feedback');
    const resultWrapper = document.getElementById('cert-result-wrapper');

    // Cek aturan rilis sertifikat
    const releaseMode = ev.certReleaseMode || 'auto';
    const st = computeEventStatus(ev);
    if (releaseMode === 'hold' || (releaseMode === 'auto' && st === 'mendatang')) {
      resultWrapper.classList.add('hidden');
      feedbackBox.classList.remove('hidden');
      feedbackBox.innerHTML = `
        <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <strong>E-Sertifikat Belum Dirilis:</strong> Panitia belum membuka penerbitan sertifikat untuk kegiatan ini. Silakan cek kembali setelah sesi kegiatan selesai.
        </div>`;
      return;
    }

    const matched = currentEventAttendees.find((att) => {
      if (queryPhone.length >= 8 && U.normalizePhone(att.phone) === queryPhone) return true;
      if (queryLower.length >= 3 && String(att.name || '').toLowerCase().includes(queryLower)) return true;
      return false;
    });

    if (!matched) {
      resultWrapper.classList.add('hidden');
      feedbackBox.classList.remove('hidden');
      feedbackBox.innerHTML = `
        <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm">
          <strong>Data Peserta Tidak Ditemukan:</strong> Pastikan Anda sudah mengisi formulir daftar hadir pada kegiatan ini dan nomor HP / nama sesuai dengan data presensi.
        </div>`;
      return;
    }

    lastMatchedAttendee = matched;
    feedbackBox.classList.add('hidden');
    resultWrapper.classList.remove('hidden');

    const certNumber = formatCertNumber(ev, matched);
    document.getElementById('cert-holder-summary').textContent = `${matched.name} — No. ${certNumber}`;

    const templateDataUrl = await loadEventCertTemplate(ev.id, ev);
    await renderCertificateToCanvas(
      document.getElementById('participant-cert-canvas'),
      ev,
      matched,
      certNumber,
      templateDataUrl
    );
  };

  function formatCertNumber(ev, att) {
    const seq = String(att.certSeq || 1).padStart(3, '0');
    const prefix = ev.certNumberPrefix || '421/JSIT-LPG/2026';
    return `${seq}/${prefix}`;
  }

  async function renderCertificateToCanvas(canvas, ev, att, certNumber, customTemplateDataUrl) {
    const ctx = canvas.getContext('2d');
    const W = 1754;
    const H = 1240;
    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    if (customTemplateDataUrl) {
      await drawImageAsync(ctx, customTemplateDataUrl, 0, 0, W, H);
    } else {
      // Desain Bawaan Profesional JSIT Wilayah Lampung (A4 Landscape 1754x1240)
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#F8FAFC');
      grad.addColorStop(1, '#EFF6FF');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Bingkai Ganda Emas & Biru Navy
      ctx.strokeStyle = '#0B1F3A';
      ctx.lineWidth = 18;
      ctx.strokeRect(48, 48, W - 96, H - 96);

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 4;
      ctx.strokeRect(76, 76, W - 152, H - 152);

      // Header Lembaga
      ctx.fillStyle = '#0B1F3A';
      ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JARINGAN SEKOLAH ISLAM TERPADU (JSIT) INDONESIA', W / 2, 175);
      ctx.fillStyle = '#1D4ED8';
      ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('WILAYAH LAMPUNG', W / 2, 215);

      // Judul Sertifikat
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 76px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('SERTIFIKAT', W / 2, 325);

      ctx.fillStyle = '#475569';
      ctx.font = '600 24px Inter, sans-serif';
      ctx.fillText(`Nomor: ${certNumber}`, W / 2, 372);

      ctx.fillStyle = '#334155';
      ctx.font = '500 26px Inter, sans-serif';
      ctx.fillText('Diberikan kepada:', W / 2, 445);

      // Nama Peserta
      ctx.fillStyle = '#0B1F3A';
      ctx.font = '800 58px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(att.name || '-', W / 2, 530);

      // Garis bawah nama
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 420, 555);
      ctx.lineTo(W / 2 + 420, 555);
      ctx.stroke();

      // Instansi
      ctx.fillStyle = '#1D4ED8';
      ctx.font = '700 28px Inter, sans-serif';
      ctx.fillText(att.institution || '', W / 2, 602);

      // Keterangan Peran & Kegiatan
      ctx.fillStyle = '#334155';
      ctx.font = '500 25px Inter, sans-serif';
      ctx.fillText(`Atas partisipasinya sebagai PESERTA dalam kegiatan:`, W / 2, 670);

      ctx.fillStyle = '#0F172A';
      ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
      const titleLines = U.wrapCanvasText(ctx, ev.title || '', 1260);
      titleLines.slice(0, 2).forEach((line, idx) => {
        ctx.fillText(line, W / 2, 725 + idx * 46);
      });

      ctx.fillStyle = '#475569';
      ctx.font = '500 23px Inter, sans-serif';
      ctx.fillText(
        `Diselenggarakan pada tanggal ${U.formatDateRange(ev.startDate, ev.endDate)} di ${ev.location || 'Bandar Lampung'}`,
        W / 2,
        835
      );

      // Tanda Tangan Ketua
      const signX = W - 430;
      ctx.fillStyle = '#334155';
      ctx.font = '500 22px Inter, sans-serif';
      ctx.fillText(`Bandar Lampung, ${U.formatDateSingle(ev.endDate || ev.startDate)}`, signX, 920);
      ctx.fillText(ev.certSignerRole || 'Ketua JSIT Wilayah Lampung', signX, 955);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(ev.certSignerName || 'Pengurus Wilayah JSIT Lampung', signX, 1095);

      // QR Code Verifikasi di Kiri Bawah
      const verifyText = `VERIFIKASI RESMI JSIT LAMPUNG | No: ${certNumber} | Nama: ${att.name} | Kegiatan: ${ev.title}`;
      const qrUrl = U.generateQrDataUrl(verifyText, 220);
      await drawImageAsync(ctx, qrUrl, 165, 905, 185, 185);
      ctx.fillStyle = '#64748B';
      ctx.font = '500 16px Inter, sans-serif';
      ctx.fillText('Pindai QR untuk validasi', 257, 1112);
      return;
    }

    // Jika menggunakan template kustom dari Studio Admin, render elemen sesuai koordinat layout
    const layout = ev.certLayout || {
      name: { x: 50, y: 44, size: 56, color: '#0B1F3A', visible: true },
      institution: { x: 50, y: 51, size: 28, color: '#1D4ED8', visible: true },
      number: { x: 50, y: 33, size: 24, color: '#334155', visible: true },
      qr: { x: 14, y: 78, size: 170, visible: true }
    };

    ctx.textAlign = 'center';
    if (layout.number?.visible !== false) {
      ctx.fillStyle = layout.number?.color || '#334155';
      ctx.font = `600 ${layout.number?.size || 24}px Inter, sans-serif`;
      ctx.fillText(`Nomor: ${certNumber}`, (W * (layout.number?.x ?? 50)) / 100, (H * (layout.number?.y ?? 33)) / 100);
    }

    if (layout.name?.visible !== false) {
      ctx.fillStyle = layout.name?.color || '#0B1F3A';
      ctx.font = `800 ${layout.name?.size || 56}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(att.name || '', (W * (layout.name?.x ?? 50)) / 100, (H * (layout.name?.y ?? 44)) / 100);
    }

    if (layout.institution?.visible !== false) {
      ctx.fillStyle = layout.institution?.color || '#1D4ED8';
      ctx.font = `700 ${layout.institution?.size || 28}px Inter, sans-serif`;
      ctx.fillText(att.institution || '', (W * (layout.institution?.x ?? 50)) / 100, (H * (layout.institution?.y ?? 51)) / 100);
    }

    if (layout.qr?.visible !== false) {
      const qrSize = Number(layout.qr?.size || 170);
      const verifyText = `VERIFIKASI RESMI JSIT LAMPUNG | No: ${certNumber} | Nama: ${att.name} | Kegiatan: ${ev.title}`;
      const qrUrl = U.generateQrDataUrl(verifyText, qrSize + 40);
      const qx = (W * (layout.qr?.x ?? 14)) / 100 - qrSize / 2;
      const qy = (H * (layout.qr?.y ?? 78)) / 100 - qrSize / 2;
      await drawImageAsync(ctx, qrUrl, qx, qy, qrSize, qrSize);
    }
  }

  function drawImageAsync(ctx, src, x, y, w, h) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, x, y, w, h);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  window.downloadParticipantCertPng = function () {
    const canvas = document.getElementById('participant-cert-canvas');
    if (!canvas || !lastMatchedAttendee) return;
    const safeName = String(lastMatchedAttendee.name || 'Peserta').replace(/[^a-zA-Z0-9_-]/g, '_');
    const link = document.createElement('a');
    link.download = `E-Sertifikat_${safeName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  window.printParticipantCertPdf = function () {
    const canvas = document.getElementById('participant-cert-canvas');
    const host = document.getElementById('cert-print-host');
    if (!canvas || !host) return;
    const dataUrl = canvas.toDataURL('image/png');
    host.innerHTML = `<img src="${dataUrl}" style="width:297mm;height:210mm;object-fit:contain;display:block;" />`;
    setTimeout(() => window.print(), 150);
  };

  // Jalankan saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
