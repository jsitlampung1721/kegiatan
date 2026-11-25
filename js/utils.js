// ============================================================================
// JS/UTILS.JS — FUNGSI UTILITAS BERSAMA (PORTAL PESERTA & PANEL ADMIN)
// ============================================================================

// Konfigurasi Tailwind terpusat
if (window.tailwind) {
  window.tailwind.config = {
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
          display: ['Plus Jakarta Sans', 'sans-serif'],
        },
        colors: {
          navy: {
            950: '#061224',
            900: '#0B1F3A',
            800: '#12315B',
          },
          jsit: {
            blue: '#1D4ED8',
            sky: '#0284C7',
            light: '#EFF6FF',
            gold: '#D97706',
          }
        },
        boxShadow: {
          '2xs': '0 1px 1px 0 rgb(0 0 0 / 0.03)',
          'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        }
      }
    }
  };
}

window.JSITUtils = (() => {
  const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

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

  function isFirebaseConfigured() {
    const cfg = window.FIREBASE_CONFIG || window.JSIT_FIREBASE_CONFIG || window.firebaseConfig;
    return Boolean(
      cfg &&
      cfg.apiKey &&
      !String(cfg.apiKey).includes('GANTI_DENGAN') &&
      !String(cfg.apiKey).includes('ISI_') &&
      cfg.projectId &&
      !String(cfg.projectId).includes('GANTI_DENGAN')
    );
  }

  function getFirebaseConfig() {
    return window.FIREBASE_CONFIG || window.JSIT_FIREBASE_CONFIG || window.firebaseConfig || {};
  }

  function formatDateSingle(dateStr) {
    if (!dateStr) return '-';
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return dateStr;
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return `${d} ${MONTHS_ID[m] || parts[1]} ${y}`;
  }

  function formatDateRange(startStr, endStr) {
    if (!startStr) return '-';
    if (!endStr || startStr === endStr) return formatDateSingle(startStr);
    const s = String(startStr).split('-');
    const e = String(endStr).split('-');
    if (s.length === 3 && e.length === 3 && s[0] === e[0] && s[1] === e[1]) {
      return `${parseInt(s[2], 10)} – ${parseInt(e[2], 10)} ${MONTHS_ID[parseInt(e[1], 10) - 1]} ${e[0]}`;
    }
    return `${formatDateSingle(startStr)} – ${formatDateSingle(endStr)}`;
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

  // Generator QR Code kontras tinggi dengan cache memori agar tidak dirender berulang
  const _qrCache = new Map();
  function generateQrDataUrl(text, sizePx = 280) {
    const cacheKey = `${sizePx}|${text}`;
    if (_qrCache.has(cacheKey)) return _qrCache.get(cacheKey);

    try {
      if (typeof window.qrcode === 'function') {
        const qr = window.qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const count = qr.getModuleCount();
        const margin = 4;
        const totalModules = count + margin * 2;
        const cellSize = Math.max(4, Math.floor(sizePx / totalModules));
        const canvasSize = totalModules * cellSize;

        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        ctx.fillStyle = '#000000';
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
              ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
            }
          }
        }
        const dataUrl = canvas.toDataURL('image/png');
        _qrCache.set(cacheKey, dataUrl);
        return dataUrl;
      }
    } catch (err) {
      console.warn('QR local fallback:', err);
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&ecc=M&margin=4&color=000000&bgcolor=FFFFFF&data=${encodeURIComponent(text)}`;
  }

  // Kompresi gambar agar ringan di Firestore (< 150 KB untuk flyer, optimal A4 untuk template)
  function compressImageToDataUrl(file, maxWidth = 900, maxHeight = 1200, quality = 0.78, forceExactSize = false) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;

          if (forceExactSize) {
            w = maxWidth;
            h = maxHeight;
          } else if (w > maxWidth || h > maxHeight) {
            const ratio = Math.min(maxWidth / w, maxHeight / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
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

  // Debounce pemanggilan lucide.createIcons() agar tidak membebani CPU
  let _iconTimer = null;
  function refreshIcons() {
    clearTimeout(_iconTimer);
    _iconTimer = setTimeout(() => {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }, 30);
  }

  return {
    escapeHtml,
    sanitizeUrl,
    normalizePhone,
    isFirebaseConfigured,
    getFirebaseConfig,
    formatDateSingle,
    formatDateRange,
    parseEndTimeFromText,
    generateQrDataUrl,
    compressImageToDataUrl,
    wrapCanvasText,
    refreshIcons
  };
})();
