// ============================================================================
// JS/ADMIN-CORE.JS — LOGIKA UTAMA PANEL ADMIN JSIT WILAYAH LAMPUNG
// ============================================================================

(() => {
  const U = window.JSITUtils;

  let db = null;
  let auth = null;
  let isDemoMode = false;
  let adminEvents = [];
  let currentAttendeeEventId = '';
  let currentEventAttendees = [];
  let unsubscribeEventAttendees = null;
  let allowedAdmins = [];
  let pendingFlyerDataUrl = '';

  const DEMO_EMAIL = 'admin@jsitlampung.or.id';
  const DEMO_PASS = 'jsitlampung2026';

  // ==================== INISIALISASI & AUTENTIKASI ====================
  function initAdminApp() {
    if (U.isFirebaseConfigured() && window.firebase) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(U.getFirebaseConfig());
        }
        db = firebase.firestore();
        auth = firebase.auth();

        // Kirim instance db ke modul Studio Sertifikat
        if (window.JSITCertStudio) {
          window.JSITCertStudio.setDb(db);
        }

        auth.onAuthStateChanged(async (user) => {
          if (user) {
            const allowed = await verifyAdminAccess(user.email);
            if (allowed) {
              showWorkspace(user.email);
            } else {
              await auth.signOut();
              showLoginError(`Akun ${user.email} tidak terdaftar dalam daftar pengelola JSIT Wilayah Lampung.`);
            }
          } else {
            showLoginScreen();
          }
        });
      } catch (err) {
        console.error('Firebase Admin init error:', err);
        activateDemoAdminMode();
      }
    } else {
      activateDemoAdminMode();
    }

    U.refreshIcons();
  }

  function activateDemoAdminMode() {
    isDemoMode = true;
    const warn = document.getElementById('admin-fb-warning');
    if (warn) warn.classList.remove('hidden');

    if (sessionStorage.getItem('jsit_demo_admin_logged') === '1') {
      showWorkspace(DEMO_EMAIL);
    } else {
      showLoginScreen();
    }
  }

  async function verifyAdminAccess(email) {
    if (!email || !db) return false;
    const cleanEmail = email.trim().toLowerCase();
    try {
      const snap = await db.collection('admin_users').get();
      // Jika koleksi admin_users masih kosong, izinkan admin pertama otomatis mendaftarkan dirinya
      if (snap.empty) {
        await db.collection('admin_users').doc(cleanEmail).set({
          email: cleanEmail,
          role: 'superadmin',
          addedAt: new Date().toISOString()
        });
        return true;
      }
      return snap.docs.some((d) => String(d.data()?.email || d.id).toLowerCase() === cleanEmail);
    } catch (e) {
      console.warn('Skip cek admin_users (fallback rules):', e);
      return true;
    }
  }

  window.handleAdminLogin = async function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-login-submit');
    const errBox = document.getElementById('login-error-msg');

    errBox.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Memverifikasi Akun...';

    try {
      if (isDemoMode) {
        if (email.toLowerCase() === DEMO_EMAIL && pass === DEMO_PASS) {
          sessionStorage.setItem('jsit_demo_admin_logged', '1');
          showWorkspace(email);
        } else {
          showLoginError('Email atau kata sandi demo tidak sesuai.');
        }
      } else {
        await auth.signInWithEmailAndPassword(email, pass);
      }
    } catch (err) {
      let msg = 'Gagal masuk. Periksa kembali email dan kata sandi Anda.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Email atau kata sandi tidak cocok dengan akun Firebase Authentication.';
      }
      showLoginError(msg);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Masuk ke Dashboard Admin';
    }
  };

  function showLoginError(msg) {
    const errBox = document.getElementById('login-error-msg');
    errBox.textContent = msg;
    errBox.classList.remove('hidden');
  }

  window.handleAdminLogout = async function () {
    if (isDemoMode) {
      sessionStorage.removeItem('jsit_demo_admin_logged');
      showLoginScreen();
    } else if (auth) {
      await auth.signOut();
    }
  };

  function showLoginScreen() {
    document.getElementById('admin-workspace').classList.add('hidden');
    document.getElementById('admin-login-screen').classList.remove('hidden');
    U.refreshIcons();
  }

  function showWorkspace(email) {
    document.getElementById('admin-login-screen').classList.add('hidden');
    document.getElementById('admin-workspace').classList.remove('hidden');
    document.getElementById('admin-user-email-badge').textContent = email;

    subscribeAdminData();
    U.refreshIcons();
  }

  // ==================== REALTIME LISTENER DATA ADMIN ====================
  function subscribeAdminData() {
    if (isDemoMode) {
      adminEvents = JSON.parse(localStorage.getItem('jsit_demo_events') || '[]');
      allowedAdmins = [{ email: DEMO_EMAIL, role: 'Super Admin (Demo)' }];
      syncAllAdminViews();
      return;
    }

    db.collection('events').onSnapshot((snap) => {
      adminEvents = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
      syncAllAdminViews();
    });

    db.collection('admin_users').onSnapshot((snap) => {
      allowedAdmins = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAllowedAdmins();
    });
  }

  function syncAllAdminViews() {
    renderAdminEventsList();
    populateEventSelectors();
    if (window.JSITCertStudio) {
      window.JSITCertStudio.setEvents(adminEvents);
    }
  }

  // ==================== NAVIGASI TAB ADMIN ====================
  window.switchAdminTab = function (tab) {
    ['events', 'attendees', 'studio', 'admins'].forEach((t) => {
      const panel = document.getElementById(`admin-panel-${t}`);
      const btn = document.querySelector(`.admin-tab-btn[data-admin-tab="${t}"]`);
      if (panel) panel.classList.toggle('hidden', t !== tab);
      if (btn) {
        btn.className = t === tab
          ? 'admin-tab-btn nav-active shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition'
          : 'admin-tab-btn shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:bg-white/10 transition';
      }
    });
    U.refreshIcons();
  };

  // ==================== TAB 1: CRUD KEGIATAN ====================
  function renderAdminEventsList() {
    const container = document.getElementById('admin-events-list');
    if (adminEvents.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <p class="font-display font-bold text-lg text-slate-800">Belum Ada Agenda Kegiatan</p>
          <p class="text-sm text-slate-500 mt-1">Klik tombol "Tambah Kegiatan Baru" di kanan atas untuk membuat agenda pertama.</p>
        </div>`;
      return;
    }

    container.innerHTML = adminEvents.map((ev) => {
      const attBadge = ev.attendanceMode === 'closed'
        ? '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">Presensi Tutup</span>'
        : '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">Presensi Buka</span>';

      return `
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between space-y-4">
          <div class="space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-blue-600 truncate">${U.escapeHtml(ev.category || 'Agenda JSIT')}</span>
              ${attBadge}
            </div>
            <h3 class="font-display font-bold text-base text-slate-900 line-clamp-2">${U.escapeHtml(ev.title)}</h3>
            <div class="text-xs text-slate-500 space-y-1">
              <p><i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-1"></i> ${U.formatDateRange(ev.startDate, ev.endDate)}</p>
              <p><i data-lucide="map-pin" class="w-3.5 h-3.5 inline mr-1"></i> ${U.escapeHtml(ev.location || '-')}</p>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <button onclick="openEventModal('${U.escapeHtml(ev.id)}')" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition">
                Edit
              </button>
              <button onclick="jumpToAttendees('${U.escapeHtml(ev.id)}')" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-bold transition">
                Peserta
              </button>
              <button onclick="jumpToStudio('${U.escapeHtml(ev.id)}')" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 text-xs font-bold transition">
                Sertifikat
              </button>
            </div>
            <button onclick="deleteEvent('${U.escapeHtml(ev.id)}')" class="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 transition" title="Hapus Kegiatan">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    U.refreshIcons();
  }

  window.jumpToAttendees = function (eventId) {
    switchAdminTab('attendees');
    const sel = document.getElementById('attendee-event-selector');
    sel.value = eventId;
    onSelectAttendeeEvent(eventId);
  };

  window.jumpToStudio = function (eventId) {
    switchAdminTab('studio');
    const sel = document.getElementById('studio-event-selector');
    sel.value = eventId;
    if (window.JSITCertStudio) {
      window.JSITCertStudio.selectEvent(eventId);
    }
  };

  window.openEventModal = function (eventId = '') {
    const modal = document.getElementById('event-form-modal');
    const form = document.getElementById('event-crud-form');
    form.reset();
    pendingFlyerDataUrl = '';
    document.getElementById('ev-materials-container').innerHTML = '';

    if (eventId) {
      const ev = adminEvents.find((x) => x.id === eventId);
      if (!ev) return;
      document.getElementById('event-modal-title').textContent = 'Edit Detail Kegiatan';
      document.getElementById('ev-id').value = ev.id;
      document.getElementById('ev-title').value = ev.title || '';
      document.getElementById('ev-category').value = ev.category || '';
      document.getElementById('ev-start-date').value = ev.startDate || '';
      document.getElementById('ev-end-date').value = ev.endDate || '';
      document.getElementById('ev-time').value = ev.time || '';
      document.getElementById('ev-location').value = ev.location || '';
      document.getElementById('ev-speakers').value = ev.speakers || '';
      document.getElementById('ev-manual-status').value = ev.manualStatus || '';
      document.getElementById('ev-attendance-mode').value = ev.attendanceMode || 'open';
      document.getElementById('ev-description').value = ev.description || '';
      document.getElementById('ev-rundown').value = ev.rundown || '';
      document.getElementById('ev-flyer-url').value = ev.flyerUrl || '';
      pendingFlyerDataUrl = ev.flyerDataUrl || '';

      (ev.materials || []).forEach((m) => addMaterialRow(m.title, m.url));
    } else {
      document.getElementById('event-modal-title').textContent = 'Tambah Kegiatan Baru';
      document.getElementById('ev-id').value = '';
      addMaterialRow();
    }

    modal.classList.remove('hidden');
    U.refreshIcons();
  };

  window.closeEventModal = function () {
    document.getElementById('event-form-modal').classList.add('hidden');
  };

  window.addMaterialRow = function (title = '', url = '') {
    const box = document.getElementById('ev-materials-container');
    const row = document.createElement('div');
    row.className = 'material-item-row grid grid-cols-1 sm:grid-cols-12 gap-2 items-center';
    row.innerHTML = `
      <input type="text" placeholder="Judul Materi (misal: Slide Narasumber)" value="${U.escapeHtml(title)}" class="mat-title sm:col-span-5 px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white" />
      <input type="url" placeholder="https://drive.google.com/..." value="${U.escapeHtml(url)}" class="mat-url sm:col-span-6 px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white" />
      <button type="button" onclick="this.parentElement.remove()" class="sm:col-span-1 py-2 text-rose-500 hover:bg-rose-50 rounded-xl text-xs font-bold">Hapus</button>
    `;
    box.appendChild(row);
  };

  window.handleFlyerUpload = async function (e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Kompres flyer ke maks 800x1000 kualitas 0.72 agar < 120 KB
      pendingFlyerDataUrl = await U.compressImageToDataUrl(file, 800, 1000, 0.72, false);
    } catch (err) {
      alert('Gagal memproses gambar poster.');
    }
  };

  window.saveEventForm = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-event');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const existingId = document.getElementById('ev-id').value;
    const materials = [];
    document.querySelectorAll('.material-item-row').forEach((row) => {
      const t = row.querySelector('.mat-title').value.trim();
      const u = row.querySelector('.mat-url').value.trim();
      if (t || u) materials.push({ title: t || 'Materi Kegiatan', url: u });
    });

    const payload = {
      title: document.getElementById('ev-title').value.trim(),
      category: document.getElementById('ev-category').value.trim() || 'Agenda JSIT Lampung',
      startDate: document.getElementById('ev-start-date').value,
      endDate: document.getElementById('ev-end-date').value || document.getElementById('ev-start-date').value,
      time: document.getElementById('ev-time').value.trim(),
      location: document.getElementById('ev-location').value.trim(),
      speakers: document.getElementById('ev-speakers').value.trim(),
      manualStatus: document.getElementById('ev-manual-status').value,
      attendanceMode: document.getElementById('ev-attendance-mode').value,
      description: document.getElementById('ev-description').value.trim(),
      rundown: document.getElementById('ev-rundown').value.trim(),
      flyerUrl: document.getElementById('ev-flyer-url').value.trim(),
      flyerDataUrl: pendingFlyerDataUrl,
      materials,
      updatedAt: new Date().toISOString()
    };

    try {
      if (isDemoMode) {
        if (existingId) {
          const idx = adminEvents.findIndex((x) => x.id === existingId);
          if (idx >= 0) adminEvents[idx] = { ...adminEvents[idx], ...payload };
        } else {
          adminEvents.unshift({ id: 'demo-' + Date.now(), ...payload });
        }
        localStorage.setItem('jsit_demo_events', JSON.stringify(adminEvents));
        syncAllAdminViews();
      } else if (existingId) {
        await db.collection('events').doc(existingId).set(payload, { merge: true });
      } else {
        payload.createdAt = new Date().toISOString();
        await db.collection('events').add(payload);
      }
      closeEventModal();
    } catch (err) {
      console.error('Save event error:', err);
      alert('Gagal menyimpan kegiatan. Pastikan ukuran gambar poster tidak terlalu besar.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan Kegiatan';
    }
  };

  window.deleteEvent = async function (eventId) {
    if (!confirm('Yakin ingin menghapus kegiatan ini beserta pengaturannya?')) return;
    if (isDemoMode) {
      adminEvents = adminEvents.filter((x) => x.id !== eventId);
      localStorage.setItem('jsit_demo_events', JSON.stringify(adminEvents));
      syncAllAdminViews();
      return;
    }
    await db.collection('events').doc(eventId).delete();
  };

  // ==================== TAB 2: DAFTAR HADIR PESERTA ====================
  function populateEventSelectors() {
    const options = ['<option value="">-- Pilih Kegiatan --</option>']
      .concat(adminEvents.map((ev) => `<option value="${U.escapeHtml(ev.id)}">${U.escapeHtml(ev.title)}</option>`))
      .join('');

    const attSel = document.getElementById('attendee-event-selector');
    const stuSel = document.getElementById('studio-event-selector');
    if (attSel) {
      const prev = attSel.value;
      attSel.innerHTML = options;
      if (prev) attSel.value = prev;
    }
    if (stuSel) {
      const prev = stuSel.value;
      stuSel.innerHTML = options;
      if (prev) stuSel.value = prev;
    }
  }

  window.onSelectAttendeeEvent = function (eventId) {
    currentAttendeeEventId = eventId;
    if (unsubscribeEventAttendees) {
      unsubscribeEventAttendees();
      unsubscribeEventAttendees = null;
    }
    currentEventAttendees = [];

    if (!eventId) {
      renderAdminAttendeesTable();
      return;
    }

    if (isDemoMode) {
      currentEventAttendees = JSON.parse(localStorage.getItem(`jsit_local_att_${eventId}`) || '[]');
      renderAdminAttendeesTable();
      return;
    }

    unsubscribeEventAttendees = db
      .collection('events')
      .doc(eventId)
      .collection('attendees')
      .onSnapshot((snap) => {
        currentEventAttendees = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.certSeq || 0) - (b.certSeq || 0));
        renderAdminAttendeesTable();
      });
  };

  window.renderAdminAttendeesTable = function () {
    const tbody = document.getElementById('admin-attendees-tbody');
    const sub = document.getElementById('attendee-table-subtitle');
    const q = (document.getElementById('admin-attendee-search')?.value || '').trim().toLowerCase();

    if (!currentAttendeeEventId) {
      sub.textContent = 'Pilih kegiatan di atas untuk memuat daftar peserta.';
      tbody.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-slate-400">Belum ada kegiatan yang dipilih.</td></tr>';
      return;
    }

    const filtered = currentEventAttendees.filter((a) => {
      if (!q) return true;
      return `${a.name || ''} ${a.institution || ''} ${a.phone || ''} ${a.city || ''}`.toLowerCase().includes(q);
    });

    sub.textContent = `Menampilkan ${filtered.length} dari ${currentEventAttendees.length} peserta hadir.`;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-slate-400">Belum ada data peserta hadir untuk kegiatan ini.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((att, i) => `
      <tr class="hover:bg-slate-50/80">
        <td class="py-3 px-4 font-semibold text-slate-500">${att.certSeq || i + 1}</td>
        <td class="py-3 px-4 font-bold text-slate-900">${U.escapeHtml(att.name)}</td>
        <td class="py-3 px-4 text-slate-600">${U.escapeHtml(att.phone)}</td>
        <td class="py-3 px-4 text-slate-700">${U.escapeHtml(att.institution)}</td>
        <td class="py-3 px-4 text-slate-600">${U.escapeHtml(att.city || '-')}</td>
        <td class="py-3 px-4 text-right">
          <button onclick="deleteAttendeeRecord('${U.escapeHtml(att.id)}')" class="text-xs font-bold text-rose-600 hover:underline">Hapus</button>
        </td>
      </tr>
    `).join('');
  };

  window.deleteAttendeeRecord = async function (attId) {
    if (!currentAttendeeEventId || !confirm('Hapus data peserta ini dari daftar hadir?')) return;
    if (isDemoMode) {
      currentEventAttendees = currentEventAttendees.filter((x) => x.id !== attId);
      localStorage.setItem(`jsit_local_att_${currentAttendeeEventId}`, JSON.stringify(currentEventAttendees));
      renderAdminAttendeesTable();
      return;
    }
    await db.collection('events').doc(currentAttendeeEventId).collection('attendees').doc(attId).delete();
  };

  window.exportAttendeesCsv = function () {
    if (!currentAttendeeEventId || currentEventAttendees.length === 0) {
      alert('Pilih kegiatan yang memiliki data peserta terlebih dahulu.');
      return;
    }
    const headers = ['No Urut', 'Nama Lengkap', 'No HP', 'Email', 'Sekolah/Instansi', 'Jabatan', 'Kab/Kota', 'Waktu Presensi'];
    const rows = currentEventAttendees.map((a, idx) => [
      a.certSeq || idx + 1,
      `"${String(a.name || '').replace(/"/g, '""')}"`,
      `"${String(a.phone || '')}"`,
      `"${String(a.email || '')}"`,
      `"${String(a.institution || '').replace(/"/g, '""')}"`,
      `"${String(a.role || '').replace(/"/g, '""')}"`,
      `"${String(a.city || '')}"`,
      `"${String(a.submittedAt || '')}"`
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Daftar_Hadir_${currentAttendeeEventId}.csv`;
    link.click();
  };

  // ==================== TAB 4: AKUN PENGELOLA ====================
  function renderAllowedAdmins() {
    const box = document.getElementById('allowed-admins-list');
    if (!box) return;
    if (allowedAdmins.length === 0) {
      box.innerHTML = '<div class="p-4 text-xs text-slate-500">Belum ada daftar email admin.</div>';
      return;
    }
    box.innerHTML = allowedAdmins.map((adm) => {
      const email = adm.email || adm.id;
      return `
        <div class="p-4 flex items-center justify-between gap-3 bg-white">
          <div>
            <p class="text-sm font-bold text-slate-800">${U.escapeHtml(email)}</p>
            <p class="text-[11px] text-slate-400">Pengelola Terdaftar</p>
          </div>
          <button onclick="removeAllowedAdmin('${U.escapeHtml(email)}')" class="text-xs font-bold text-rose-600 hover:underline">
            Hapus Akses
          </button>
        </div>
      `;
    }).join('');
  }

  window.addAllowedAdmin = async function (e) {
    e.preventDefault();
    const input = document.getElementById('new-admin-email');
    const email = input.value.trim().toLowerCase();
    if (!email) return;

    if (isDemoMode) {
      allowedAdmins.push({ email });
      renderAllowedAdmins();
      input.value = '';
      return;
    }

    await db.collection('admin_users').doc(email).set({
      email,
      addedAt: new Date().toISOString()
    });
    input.value = '';
  };

  window.removeAllowedAdmin = async function (email) {
    if (allowedAdmins.length <= 1) {
      alert('Minimal harus tersisa 1 akun admin aktif.');
      return;
    }
    if (!confirm(`Cabut akses admin untuk ${email}?`)) return;
    if (!isDemoMode && db) {
      await db.collection('admin_users').doc(email.toLowerCase()).delete();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminApp);
  } else {
    initAdminApp();
  }
})();
