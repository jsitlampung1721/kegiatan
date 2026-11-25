// ============================================================================
// CORE UTILITIES — JSIT LAMPUNG PORTAL & ADMIN
// ============================================================================
window.JSITUtils = (function () {
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeUrl(url) {
    const s = String(url || '').trim();
    if (!s) return '#';
    if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
    return 'https://' + s;
  }

  function normalizePhone(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('62')) digits = '0' + digits.slice(2);
    return digits;
  }

  function formatDateIndo(start, end) {
    if (!start) return '-';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const parsePart = (str) => {
      const p = String(str).split('-');
      if (p.length !== 3) return str;
      return `${parseInt(p[2], 10)} ${months[parseInt(p[1], 10) - 1] || p[1]} ${p[0]}`;
    };
    if (!end || start === end) return parsePart(start);
    const s = String(start).split('-');
    const e = String(end).split('-');
    if (s.length === 3 && e.length === 3 && s[0] === e[0] && s[1] === e[1]) {
      return `${parseInt(s[2], 10)} – ${parseInt(e[2], 10)} ${months[parseInt(e[1], 10) - 1]} ${e[0]}`;
    }
    return `${parsePart(start)} – ${parsePart(end)}`;
  }

  function parseEndTimeFromText(timeStr) {
    if (!timeStr) return '16:00';
    const matches = String(timeStr).match(/(\d{1,2})[.:](\d{2})/g);
    if (matches && matches.length > 0) {
      const last = matches[matches.length - 1].replace('.', ':');
      const [h, m] = last.split(':');
      return `${String(Math.min(23, parseInt(h, 10))).padStart(2, '0')}:${String(Math.min(59, parseInt(m, 10))).padStart(2, '0')}`;
    }
    return '16:00';
  }

  function getCertificateReleaseDate(ev) {
    const cert = ev.certificate || ev.certConfig || {};
    const dStr = cert.customEndDate || cert.endDate || ev.dateEnd || ev.dateStart || '2026-12-31';
    const tStr = cert.customEndTime || cert.endTime || ev.timeEnd || parseEndTimeFromText(ev.time);
    const [y, mo, d] = dStr.split('-').map(Number);
    const [hh, mm] = tStr.split(':').map(Number);
    return new Date(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  }

  function isCertificateReleased(ev) {
    const cert = ev.certificate || ev.certConfig || {};
    if (cert.releaseMode === 'disabled' || cert.enabled === false) return false;
    if (cert.releaseMode === 'manual_now') return true;
    return new Date() >= getCertificateReleaseDate(ev);
  }

  function generateQrDataUrl(text, size = 320) {
    try {
      if (typeof window.qrcode === 'function') {
        const qr = window.qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const count = qr.getModuleCount();
        const margin = 4;
        const totalModules = count + margin * 2;
        const cellSize = Math.max(6, Math.floor(size / totalModules));
        const canvasSize = totalModules * cellSize;

        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        ctx.fillStyle = '#000000';
        for (let row = 0; row < count; row++) {
          for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
              ctx.fillRect((col + margin) * cellSize, (row + margin) * cellSize, cellSize, cellSize);
            }
          }
        }
        return canvas.toDataURL('image/png');
      }
    } catch (err) {
      console.warn('QR local fallback:', err);
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&margin=2&color=000000&bgcolor=FFFFFF&data=${encodeURIComponent(text)}`;
  }

  function compressImageFile(file, maxDim = 1100, quality = 0.82, forceExactSize = null) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (forceExactSize) {
            w = forceExactSize.w;
            h = forceExactSize.h;
          } else if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadImageSmart(file, storageFolder, options = {}) {
    const { maxDim = 1100, quality = 0.82, forceExactSize = null } = options;
    const dataUrl = await compressImageFile(file, maxDim, quality, forceExactSize);

    // Jika Firebase Storage tersedia, unggah ke Cloud Storage sehingga dokumen Firestore tetap super ringan (< 2 KB)
    if (window.JSITFirebase && window.JSITFirebase.storage) {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const fileName = `${storageFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        const ref = window.JSITFirebase.storage.ref().child(fileName);
        await ref.put(blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' });
        return await ref.getDownloadURL();
      } catch (err) {
        console.warn('Upload Storage fallback to compressed DataURL:', err);
      }
    }
    return dataUrl;
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text || '').split(' ');
    const lines = [];
    let currentLine = words[0] || '';
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      if (ctx.measureText(testLine).width < maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  return {
    escapeHtml,
    sanitizeUrl,
    normalizePhone,
    formatDateIndo,
    parseEndTimeFromText,
    getCertificateReleaseDate,
    isCertificateReleased,
    generateQrDataUrl,
    compressImageFile,
    uploadImageSmart,
    wrapCanvasText
  };
})();
