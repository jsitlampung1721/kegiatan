// ============================================================================
// JS/ADMIN-CERT-STUDIO.JS — STUDIO DESAIN E-SERTIFIKAT A4 LANDSCAPE
// ============================================================================

window.JSITCertStudio = (() => {
  const U = window.JSITUtils;

  let db = null;
  let eventsList = [];
  let selectedEventId = '';
  let currentTemplateDataUrl = null;
  let templateChanged = false;

  function setDb(firestoreInstance) {
    db = firestoreInstance;
  }

  function setEvents(events) {
    eventsList = Array.isArray(events) ? events : [];
  }

  async function selectEvent(eventId) {
    selectedEventId = eventId;
    templateChanged = false;
    currentTemplateDataUrl = null;

    const grid = document.getElementById('studio-workspace-grid');
    if (!eventId) {
      if (grid) {
        grid.classList.add('hidden');
        grid.classList.remove('grid');
      }
      return;
    }

    const ev = eventsList.find((x) => x.id === eventId);
    if (!ev) return;

    if (grid) {
      grid.classList.remove('hidden');
      grid.classList.add('grid');
    }

    // Isi field pengaturan sertifikat
    document.getElementById('studio-cert-prefix').value = ev.certNumberPrefix || '421/JSIT-LPG/2026';
    document.getElementById('studio-signer-name').value = ev.certSignerName || 'H. Ahmad Muzakki, M.Pd.';
    document.getElementById('studio-signer-role').value = ev.certSignerRole || 'Ketua JSIT Wilayah Lampung';
    document.getElementById('studio-release-mode').value = ev.certReleaseMode || 'auto';

    const layout = ev.certLayout || {};
    document.getElementById('pos-name-y').value = layout.name?.y ?? 44;
    document.getElementById('size-name').value = layout.name?.size ?? 56;
    document.getElementById('color-name').value = layout.name?.color || '#0B1F3A';
    document.getElementById('pos-inst-y').value = layout.institution?.y ?? 51;
    document.getElementById('pos-num-y').value = layout.number?.y ?? 33;
    document.getElementById('pos-qr-x').value = layout.qr?.x ?? 14;
    document.getElementById('pos-qr-y').value = layout.qr?.y ?? 78;

    // Muat template sertifikat (kompatibel dengan dokumen lama & sub-dokumen privat baru)
    if (ev.customTemplateImg) {
      currentTemplateDataUrl = ev.customTemplateImg;
    } else if (db && !String(eventId).startsWith('demo-')) {
      try {
        const snap = await db.collection('events').doc(eventId).collection('private').doc('cert_template').get();
        if (snap.exists && snap.data()?.imageDataUrl) {
          currentTemplateDataUrl = snap.data().imageDataUrl;
        }
      } catch (err) {
        console.warn('Gagal memuat template privat:', err);
      }
    } else {
      currentTemplateDataUrl = localStorage.getItem(`jsit_demo_tpl_${eventId}`) || null;
    }

    await renderStudioPreview();
    U.refreshIcons();
  }

  window.onSelectStudioEvent = function (eventId) {
    selectEvent(eventId);
  };

  window.handleStudioTemplateUpload = async function (e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Kompres tepat ke ukuran A4 Landscape (1754x1240) kualitas 0.80 agar tajam namun tetap di bawah batas 1MB Firestore
      currentTemplateDataUrl = await U.compressImageToDataUrl(file, 1754, 1240, 0.80, true);
      templateChanged = true;
      await renderStudioPreview();
    } catch (err) {
      alert('Gagal membaca file template sertifikat.');
    }
  };

  window.clearStudioCustomTemplate = async function () {
    currentTemplateDataUrl = null;
    templateChanged = true;
    const input = document.getElementById('studio-template-file');
    if (input) input.value = '';
    await renderStudioPreview();
  };

  function getLayoutFromInputs() {
    return {
      name: {
        x: 50,
        y: Number(document.getElementById('pos-name-y').value || 44),
        size: Number(document.getElementById('size-name').value || 56),
        color: document.getElementById('color-name').value || '#0B1F3A',
        visible: true
      },
      institution: {
        x: 50,
        y: Number(document.getElementById('pos-inst-y').value || 51),
        size: 28,
        color: '#1D4ED8',
        visible: true
      },
      number: {
        x: 50,
        y: Number(document.getElementById('pos-num-y').value || 33),
        size: 24,
        color: '#334155',
        visible: true
      },
      qr: {
        x: Number(document.getElementById('pos-qr-x').value || 14),
        y: Number(document.getElementById('pos-qr-y').value || 78),
        size: 170,
        visible: true
      }
    };
  }

  window.renderStudioPreview = async function () {
    const canvas = document.getElementById('studio-preview-canvas');
    if (!canvas || !selectedEventId) return;

    const ev = eventsList.find((x) => x.id === selectedEventId) || {};
    const ctx = canvas.getContext('2d');
    const W = 1754;
    const H = 1240;
    canvas.width = W;
    canvas.height = H;

    const prefix = document.getElementById('studio-cert-prefix').value.trim() || '421/JSIT-LPG/2026';
    const signerName = document.getElementById('studio-signer-name').value.trim() || 'H. Ahmad Muzakki, M.Pd.';
    const signerRole = document.getElementById('studio-signer-role').value.trim() || 'Ketua JSIT Wilayah Lampung';
    const sampleCertNumber = `001/${prefix}`;
    const sampleName = 'Ahmad Fauzi, S.Pd., Gr.';
    const sampleInst = 'SDIT Permata Bunda Bandar Lampung';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    if (currentTemplateDataUrl) {
      await drawImageSafe(ctx, currentTemplateDataUrl, 0, 0, W, H);
      const layout = getLayoutFromInputs();

      ctx.textAlign = 'center';
      ctx.fillStyle = layout.number.color;
      ctx.font = `600 ${layout.number.size}px Inter, sans-serif`;
      ctx.fillText(`Nomor: ${sampleCertNumber}`, (W * layout.number.x) / 100, (H * layout.number.y) / 100);

      ctx.fillStyle = layout.name.color;
      ctx.font = `800 ${layout.name.size}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(sampleName, (W * layout.name.x) / 100, (H * layout.name.y) / 100);

      ctx.fillStyle = layout.institution.color;
      ctx.font = `700 ${layout.institution.size}px Inter, sans-serif`;
      ctx.fillText(sampleInst, (W * layout.institution.x) / 100, (H * layout.institution.y) / 100);

      const qrSize = layout.qr.size;
      const qrUrl = U.generateQrDataUrl(`PREVIEW VERIFIKASI JSIT LAMPUNG | ${sampleCertNumber}`, qrSize + 40);
      await drawImageSafe(
        ctx,
        qrUrl,
        (W * layout.qr.x) / 100 - qrSize / 2,
        (H * layout.qr.y) / 100 - qrSize / 2,
        qrSize,
        qrSize
      );
      return;
    }

    // Desain Bawaan JSIT Wilayah Lampung
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#F8FAFC');
    grad.addColorStop(1, '#EFF6FF');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#0B1F3A';
    ctx.lineWidth = 18;
    ctx.strokeRect(48, 48, W - 96, H - 96);

    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 4;
    ctx.strokeRect(76, 76, W - 152, H - 152);

    ctx.fillStyle = '#0B1F3A';
    ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JARINGAN SEKOLAH ISLAM TERPADU (JSIT) INDONESIA', W / 2, 175);
    ctx.fillStyle = '#1D4ED8';
    ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('WILAYAH LAMPUNG', W / 2, 215);

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 76px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('SERTIFIKAT', W / 2, 325);

    ctx.fillStyle = '#475569';
    ctx.font = '600 24px Inter, sans-serif';
    ctx.fillText(`Nomor: ${sampleCertNumber}`, W / 2, 372);

    ctx.fillStyle = '#334155';
    ctx.font = '500 26px Inter, sans-serif';
    ctx.fillText('Diberikan kepada:', W / 2, 445);

    ctx.fillStyle = '#0B1F3A';
    ctx.font = '800 58px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(sampleName, W / 2, 530);

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 420, 555);
    ctx.lineTo(W / 2 + 420, 555);
    ctx.stroke();

    ctx.fillStyle = '#1D4ED8';
    ctx.font = '700 28px Inter, sans-serif';
    ctx.fillText(sampleInst, W / 2, 602);

    ctx.fillStyle = '#334155';
    ctx.font = '500 25px Inter, sans-serif';
    ctx.fillText('Atas partisipasinya sebagai PESERTA dalam kegiatan:', W / 2, 670);

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
    const titleLines = U.wrapCanvasText(ctx, ev.title || 'Nama Kegiatan JSIT Wilayah Lampung', 1260);
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

    const signX = W - 430;
    ctx.fillStyle = '#334155';
    ctx.font = '500 22px Inter, sans-serif';
    ctx.fillText(`Bandar Lampung, ${U.formatDateSingle(ev.endDate || ev.startDate)}`, signX, 920);
    ctx.fillText(signerRole, signX, 955);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(signerName, signX, 1095);

    const qrUrl = U.generateQrDataUrl(`PREVIEW VERIFIKASI JSIT LAMPUNG | ${sampleCertNumber}`, 220);
    await drawImageSafe(ctx, qrUrl, 165, 905, 185, 185);
    ctx.fillStyle = '#64748B';
    ctx.font = '500 16px Inter, sans-serif';
    ctx.fillText('Pindai QR untuk validasi', 257, 1112);
  };

  function drawImageSafe(ctx, src, x, y, w, h) {
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

  window.saveCertStudioSettings = async function () {
    if (!selectedEventId) {
      alert('Pilih kegiatan terlebih dahulu.');
      return;
    }

    const btn = document.getElementById('btn-save-studio');
    btn.disabled = true;
    btn.innerHTML = '<span>Menyimpan...</span>';

    const metaUpdate = {
      certNumberPrefix: document.getElementById('studio-cert-prefix').value.trim() || '421/JSIT-LPG/2026',
      certSignerName: document.getElementById('studio-signer-name').value.trim(),
      certSignerRole: document.getElementById('studio-signer-role').value.trim(),
      certReleaseMode: document.getElementById('studio-release-mode').value,
      certLayout: getLayoutFromInputs(),
      // Hapus field lama di dokumen utama agar beranda index.html tetap super ringan
      customTemplateImg: ''
    };

    try {
      if (!db || String(selectedEventId).startsWith('demo-')) {
        if (currentTemplateDataUrl) {
          localStorage.setItem(`jsit_demo_tpl_${selectedEventId}`, currentTemplateDataUrl);
        } else {
          localStorage.removeItem(`jsit_demo_tpl_${selectedEventId}`);
        }
        const evList = JSON.parse(localStorage.getItem('jsit_demo_events') || '[]');
        const idx = evList.findIndex((x) => x.id === selectedEventId);
        if (idx >= 0) {
          evList[idx] = { ...evList[idx], ...metaUpdate };
          localStorage.setItem('jsit_demo_events', JSON.stringify(evList));
        }
        alert('Pengaturan E-Sertifikat berhasil disimpan (Mode Lokal).');
      } else {
        // 1. Simpan metadata ringan di dokumen utama events/{id}
        await db.collection('events').doc(selectedEventId).set(metaUpdate, { merge: true });

        // 2. Simpan gambar template berat di sub-dokumen privat agar beranda tidak terbebani
        if (templateChanged) {
          const tplRef = db.collection('events').doc(selectedEventId).collection('private').doc('cert_template');
          if (currentTemplateDataUrl) {
            await tplRef.set({
              imageDataUrl: currentTemplateDataUrl,
              updatedAt: new Date().toISOString()
            });
          } else {
            await tplRef.delete().catch(() => {});
          }
          templateChanged = false;
        }

        alert('Pengaturan & desain E-Sertifikat berhasil disimpan ke Cloud!');
      }
    } catch (err) {
      console.error('Save cert studio error:', err);
      alert('Gagal menyimpan desain sertifikat. Pastikan ukuran gambar template tidak melebihi 900 KB.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Desain & Pengaturan</span>';
      U.refreshIcons();
    }
  };

  return {
    setDb,
    setEvents,
    selectEvent
  };
})();
