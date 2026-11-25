// ============================================================================
// SHARED A4 LANDSCAPE CERTIFICATE ENGINE (1000x707 STAGE & 1754x1240 HD PNG)
// ============================================================================
window.JSITCertEngine = (function () {
  const U = window.JSITUtils;

  function renderHDCanvas(canvasEl, p, defaultOrgSub, onDone) {
    if (!canvasEl || !p) return;
    if (!p.qrDataUrl && p.verificationUrl) {
      p.qrDataUrl = U.generateQrDataUrl(p.verificationUrl, 360);
    }

    const ctx = canvasEl.getContext('2d');
    const W = canvasEl.width;
    const H = canvasEl.height;
    const S = W / 1000;

    function drawForeground() {
      const txtCol = p.customTemplateImg ? (p.textColor || '#0B1F3A') : '#0B1F3A';
      const subTxtCol = p.customTemplateImg ? txtCol : '#334155';

      if (!p.customTemplateImg || !p.hideDefaultChrome) {
        ctx.strokeStyle = p.themeColor || '#1E3A8A';
        ctx.lineWidth = Math.round(10 * S);
        ctx.strokeRect(5 * S, 5 * S, W - 10 * S, H - 10 * S);
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = Math.round(2 * S);
        ctx.strokeRect(20 * S, 20 * S, W - 40 * S, H - 40 * S);

        ctx.textAlign = 'center';
        ctx.fillStyle = p.themeColor || '#1E3A8A';
        ctx.font = `bold ${Math.round(13 * S)}px sans-serif`;
        ctx.fillText('JARINGAN SEKOLAH ISLAM TERPADU (JSIT) INDONESIA', W / 2, 62 * S);
        ctx.fillStyle = '#0F172A';
        ctx.font = `bold ${Math.round(20 * S)}px sans-serif`;
        ctx.fillText('WILAYAH PROVINSI LAMPUNG', W / 2, 92 * S);
      }

      const baseTop = (!p.customTemplateImg || !p.hideDefaultChrome) ? 158 : 165;
      let yCursor = (baseTop + (p.customTemplateImg ? (p.offsetY || 0) : 0)) * S;

      ctx.textAlign = 'center';
      if (p.showCertHeading) {
        ctx.fillStyle = p.themeColor || '#1E3A8A';
        ctx.font = `bold ${Math.round(38 * S)}px sans-serif`;
        ctx.fillText('SERTIFIKAT', W / 2, yCursor + 34 * S);
        yCursor += 48 * S;
      }

      ctx.fillStyle = p.customTemplateImg ? txtCol : '#475569';
      ctx.font = `bold ${Math.round(14 * S)}px sans-serif`;
      ctx.fillText(`Nomor: ${p.certNumber}`, W / 2, yCursor + 14 * S);
      yCursor += 38 * S;

      ctx.fillStyle = p.customTemplateImg ? txtCol : '#64748B';
      ctx.font = `500 ${Math.round(13 * S)}px sans-serif`;
      ctx.fillText('Diberikan dengan hormat kepada:', W / 2, yCursor + 13 * S);
      yCursor += 26 * S;

      ctx.fillStyle = txtCol;
      ctx.font = `bold ${Math.round(28 * S)}px sans-serif`;
      ctx.fillText(p.name, W / 2, yCursor + 28 * S);
      const nameW = ctx.measureText(p.name).width;
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = Math.round(2.5 * S);
      ctx.beginPath();
      ctx.moveTo((W - nameW) / 2 - 12 * S, yCursor + 36 * S);
      ctx.lineTo((W + nameW) / 2 + 12 * S, yCursor + 36 * S);
      ctx.stroke();
      yCursor += 50 * S;

      ctx.fillStyle = p.customTemplateImg ? txtCol : '#1E40AF';
      ctx.font = `bold ${Math.round(14.5 * S)}px sans-serif`;
      ctx.fillText(p.region ? `${p.school} — ${p.region}` : p.school, W / 2, yCursor + 14 * S);
      yCursor += 34 * S;

      ctx.fillStyle = subTxtCol;
      ctx.font = `${Math.round(13.5 * S)}px sans-serif`;
      ctx.fillText(`Atas partisipasi aktifnya sebagai ${p.roleLabel} dalam kegiatan ${p.category}:`, W / 2, yCursor + 14 * S);
      yCursor += 24 * S;

      ctx.fillStyle = txtCol;
      ctx.font = `bold ${Math.round(15.5 * S)}px sans-serif`;
      const titleLines = U.wrapCanvasText(ctx, `"${p.eventTitle}"`, 790 * S);
      titleLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, yCursor + 16 * S + i * 22 * S);
      });
      yCursor += titleLines.length * 22 * S + 22 * S;

      ctx.fillStyle = subTxtCol;
      ctx.font = `${Math.round(13.5 * S)}px sans-serif`;
      const footerDescLines = U.wrapCanvasText(
        ctx,
        `yang diselenggarakan oleh ${p.orgSubText || defaultOrgSub} pada tanggal ${p.dateRange} dengan bobot pelatihan setara ${p.jp}.`,
        790 * S
      );
      footerDescLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, yCursor + i * 21 * S);
      });

      const qrScaleRatio = (p.qrScale || 100) / 100;
      const qrBottomY = (707 - 52 + (p.qrOffsetY || 0)) * S;
      const qrBaseX = (65 + (p.qrOffsetX || 0)) * S;
      const qrSize = Math.round(96 * S * qrScaleRatio);
      const qrPad = Math.round(8 * S * qrScaleRatio);
      const qrBaseY = qrBottomY - qrSize;

      const finishRender = () => {
        const sScaleRatio = (p.signerScale || 100) / 100;
        const signerCenterX = (1000 - 65 - 160 + (p.signerOffsetX || 0)) * S;
        const signerBottomY = (707 - 52 + (p.signerOffsetY || 0)) * S;
        const signerTopY = signerBottomY - Math.round(92 * S * sScaleRatio);

        ctx.textAlign = 'center';
        if (p.showIssuedDate !== false) {
          ctx.fillStyle = p.customTemplateImg ? txtCol : '#475569';
          ctx.font = `${Math.round(11.5 * S * sScaleRatio)}px sans-serif`;
          ctx.fillText(`Bandar Lampung, ${p.issuedDate}`, signerCenterX, signerTopY);
        }
        ctx.fillStyle = txtCol;
        ctx.font = `600 ${Math.round(12.5 * S * sScaleRatio)}px sans-serif`;
        ctx.fillText(p.signerTitle, signerCenterX, signerTopY + Math.round(20 * S * sScaleRatio));
        ctx.fillStyle = '#1E40AF';
        ctx.font = `italic ${Math.round(10 * S * sScaleRatio)}px sans-serif`;
        ctx.fillText('Ditandatangani secara elektronik', signerCenterX, signerTopY + Math.round(46 * S * sScaleRatio));
        ctx.fillStyle = txtCol;
        ctx.font = `bold ${Math.round(14 * S * sScaleRatio)}px sans-serif`;
        ctx.fillText(p.signerName, signerCenterX, signerTopY + Math.round(78 * S * sScaleRatio));

        if (typeof onDone === 'function') {
          onDone(canvasEl.toDataURL('image/png'));
        }
      };

      if (p.qrDataUrl) {
        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        qrImg.onload = () => {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(qrBaseX - qrPad, qrBaseY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2);
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 2;
          ctx.strokeRect(qrBaseX - qrPad, qrBaseY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2);
          ctx.drawImage(qrImg, qrBaseX, qrBaseY, qrSize, qrSize);
          ctx.restore();

          const textStartX = qrBaseX + qrSize + Math.round(14 * S * qrScaleRatio);
          if (p.showScanBg !== false) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            ctx.fillRect(
              textStartX - 6 * S,
              qrBaseY + Math.round(10 * S * qrScaleRatio),
              Math.round(255 * S * qrScaleRatio),
              Math.round(68 * S * qrScaleRatio)
            );
          }
          ctx.textAlign = 'left';
          ctx.fillStyle = '#0B1F3A';
          ctx.font = `bold ${Math.round(10.5 * S * qrScaleRatio)}px sans-serif`;
          ctx.fillText('Scan Barcode Verifikasi', textStartX, qrBaseY + Math.round(26 * S * qrScaleRatio));
          ctx.fillStyle = '#475569';
          ctx.font = `${Math.round(10 * S * qrScaleRatio)}px sans-serif`;
          ctx.fillText(p.orgSubText || defaultOrgSub, textStartX, qrBaseY + Math.round(44 * S * qrScaleRatio));
          ctx.fillStyle = '#1D4ED8';
          ctx.font = `bold ${Math.round(10.5 * S * qrScaleRatio)}px monospace`;
          ctx.fillText(p.verCode, textStartX, qrBaseY + Math.round(62 * S * qrScaleRatio));
          finishRender();
        };
        qrImg.onerror = finishRender;
        qrImg.src = p.qrDataUrl;
      } else {
        finishRender();
      }
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    if (p.customTemplateImg) {
      const bg = new Image();
      bg.crossOrigin = 'anonymous';
      bg.onload = () => {
        ctx.drawImage(bg, 0, 0, W, H);
        drawForeground();
      };
      bg.onerror = drawForeground;
      bg.src = p.customTemplateImg;
    } else {
      drawForeground();
    }
  }

  return { renderHDCanvas };
})();
