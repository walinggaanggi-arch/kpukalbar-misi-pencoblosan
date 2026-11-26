(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  // Tata letak judul, diukur dari contoh resmi (frame 4000 × 2667 px):
  // Poppins Bold 67 pt (≈ 89 px), baris terakhir ber-baseline di y 2480, lebar maksimum ±3400 px, jarak baris 1,1×.
  const REF_W = 4000, BASE = 2480 / 2667, MAXW = 3400 / 4000, LH = 1.1;

  const F = { 1: null, 2: null };
  const photos = [];
  let sel = 0, uid = 0;
  const cv = $('cv'), ctx = cv.getContext('2d');
  const work = document.createElement('canvas');

  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  async function decode(file, maxW) {
    try {
      const b = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (!maxW || b.width <= maxW) return b;
      const s = maxW / b.width;
      const r = await createImageBitmap(b, { resizeWidth: Math.round(b.width * s), resizeHeight: Math.round(b.height * s), resizeQuality: 'high' });
      b.close();
      return r;
    } catch (e) {
      return loadImg(URL.createObjectURL(file));
    }
  }

  const frameSize = () => F[1] ? [F[1].naturalWidth, F[1].naturalHeight] : [REF_W, 2667];

  function place(p, img, W, H) {
    const s = Math.max(W / img.width, H / img.height) * p.zoom;
    const dw = img.width * s, dh = img.height * s;
    const mx = Math.max(0, (dw - W) / 2 / W), my = Math.max(0, (dh - H) / 2 / H);
    p.ox = Math.min(mx, Math.max(-mx, p.ox));
    p.oy = Math.min(my, Math.max(-my, p.oy));
    return [(W - dw) / 2 + p.ox * W, (H - dh) / 2 + p.oy * H, dw, dh];
  }

  function wrap(c, text, maxW) {
    const out = [];
    text.toUpperCase().split(/\n/).forEach(par => {
      const words = par.trim().split(/\s+/).filter(Boolean);
      let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (!cur || c.measureText(t).width <= maxW) cur = t;
        else { out.push(cur); cur = w; }
      }
      if (cur) out.push(cur);
    });
    return out;
  }

  function drawTitle(c, W, H) {
    const t = $('title').value.trim();
    if (!t) return;
    const k = W / REF_W, px = (+$('size').value || 67) * 4 / 3 * k;
    c.save();
    c.font = `${$('weight').value} ${px}px Poppins, "Helvetica Neue", Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#ffffff';
    if ($('shadow').checked) { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 10 * k; c.shadowOffsetY = 4 * k; }
    const ls = wrap(c, t, MAXW * W), lh = px * LH, base = BASE * H;
    ls.forEach((ln, i) => c.fillText(ln, W / 2, base - (ls.length - 1 - i) * lh));
    c.restore();
  }

  const frameOf = (p, idx) => p.frame || (idx === 0 ? 1 : 2);

  function compose(c, W, H, p, img, idx) {
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    const [x, y, dw, dh] = place(p, img, W, H);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, x, y, dw, dh);
    const fn = frameOf(p, idx), fr = F[fn];
    if (fr) c.drawImage(fr, 0, 0, W, H);
    if (fn === 1 || $('allTitle').checked) drawTitle(c, W, H);
  }

  // ---------- pratinjau ----------
  function render() {
    const [FW, FH] = frameSize();
    const W = 1600, H = Math.round(W * FH / FW);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    $('empty').style.display = photos.length ? 'none' : '';
    const ok = photos.length > 0;
    ['zipBtn', 'oneBtn', 'reset', 'left', 'right', 'first', 'del', 'zoom', 'shareBtn', 'copyImg'].forEach(id => $(id).disabled = !ok);
    if (!ok) shareReady = null;
    if (!ok) {
      ctx.clearRect(0, 0, W, H);
      if (F[1]) { ctx.globalAlpha = .9; ctx.drawImage(F[1], 0, 0, W, H); ctx.globalAlpha = 1; drawTitle(ctx, W, H); }
      return;
    }
    const p = photos[sel];
    $('zoom').value = p.zoom;
    compose(ctx, W, H, p, p.prev, sel);
  }

  function thumb(i) {
    const p = photos[i], c = p.tc, [FW, FH] = frameSize();
    c.width = 300; c.height = Math.round(300 * FH / FW);
    compose(c.getContext('2d'), c.width, c.height, p, p.prev, i);
  }

  function renderList() {
    shareReady = null; setShareLabel();
    const list = $('list');
    list.querySelectorAll('.th').forEach(e => e.remove());
    photos.forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'th' + (i === sel ? ' sel' : '');
      d.tabIndex = 0;
      d.setAttribute('role', 'button');
      const fu = frameOf(p, i) === 1;
      d.setAttribute('aria-label', `Foto ${i + 1}, frame ${fu ? 'utama' : 'lanjutan'}`);
      d.append(p.tc);
      const n = document.createElement('span');
      n.className = 'n ' + (fu ? 'u' : 'u2');
      n.textContent = `${i + 1} · ${fu ? 'Utama' : 'Lanjutan'}`;
      d.append(n);
      d.onclick = () => { sel = i; renderList(); render(); };
      d.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.click(); } };
      list.insertBefore(d, $('count'));
      thumb(i);
    });
    const nu = photos.filter((p, i) => frameOf(p, i) === 1).length;
    $('count').textContent = photos.length ? `${photos.length} foto · ${nu} utama + ${photos.length - nu} lanjutan` : '';
    $('addMore').hidden = !photos.length;
    syncFrameBtns();
  }
  function syncFrameBtns() {
    const ok = photos.length > 0, f = ok ? frameOf(photos[sel], sel) : 0;
    $('fr1').setAttribute('aria-pressed', f === 1); $('fr2').setAttribute('aria-pressed', f === 2);
    $('fr1').disabled = $('fr2').disabled = !ok;
  }
  const setFrame = n => { if (!photos.length) return; photos[sel].frame = n; renderList(); render(); };
  $('fr1').onclick = () => setFrame(1);
  $('fr2').onclick = () => setFrame(2);
  $('addMore').onclick = () => $('file').click();

  let tT = 0;
  const refreshSoon = () => { shareReady = null; if (typeof setShareLabel === 'function') setShareLabel(); render(); clearTimeout(tT); tT = setTimeout(() => photos.forEach((_, i) => thumb(i)), 150); };

  // ---------- tambah foto ----------
  async function addFiles(files) {
    const imgs = [...files].filter(f => /^image\//.test(f.type));
    if (!imgs.length) return;
    msg(`Memuat ${imgs.length} foto...`);
    for (const f of imgs) {
      try {
        const prev = await decode(f, 1800);
        photos.push({ id: ++uid, file: f, prev, zoom: 1, ox: 0, oy: 0, tc: document.createElement('canvas') });
      } catch (e) { msg(`Foto ${f.name} tidak bisa dibaca.`); }
    }
    if (photos.length && sel >= photos.length) sel = 0;
    renderList(); render();
    msg(`${photos.length} foto siap. Tambah foto lagi kapan saja; foto baru memakai frame lanjutan.`);
  }
  const drop = $('drop'), fileIn = $('file');
  drop.onclick = () => fileIn.click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } };
  fileIn.onchange = () => { addFiles(fileIn.files); fileIn.value = ''; };
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('on'); }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' || e.target === document.documentElement) drop.classList.remove('on'); }));
  document.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  // ---------- geser & zoom ----------
  let drag = null;
  cv.addEventListener('pointerdown', e => { if (!photos.length) return; cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = cv.getBoundingClientRect(), p = photos[sel];
    p.ox += (e.clientX - drag.x) / r.width;
    p.oy += (e.clientY - drag.y) / r.height;
    drag = { x: e.clientX, y: e.clientY };
    render();
  });
  ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { if (drag) { drag = null; thumb(sel); shareReady = null; setShareLabel(); } }));
  cv.addEventListener('wheel', e => {
    if (!photos.length) return;
    e.preventDefault();
    const p = photos[sel];
    p.zoom = Math.min(3, Math.max(1, p.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
    refreshSoon();
  }, { passive: false });
  $('zoom').oninput = e => { if (!photos.length) return; photos[sel].zoom = +e.target.value; refreshSoon(); };
  $('reset').onclick = () => { const p = photos[sel]; p.zoom = 1; p.ox = 0; p.oy = 0; refreshSoon(); };
  const move = (from, to) => { const [p] = photos.splice(from, 1); photos.splice(to, 0, p); sel = to; renderList(); render(); };
  $('left').onclick = () => { if (sel > 0) move(sel, sel - 1); };
  $('right').onclick = () => { if (sel < photos.length - 1) move(sel, sel + 1); };
  $('first').onclick = () => { if (sel > 0) move(sel, 0); };
  $('del').onclick = () => {
    const [p] = photos.splice(sel, 1);
    if (p && p.prev.close) p.prev.close();
    sel = Math.max(0, Math.min(sel, photos.length - 1));
    renderList(); render();
  };

  ['title', 'size', 'weight', 'shadow', 'allTitle'].forEach(id => $(id).addEventListener('input', refreshSoon));

  // ---------- frame ----------
  let fSlot = 1;
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { fSlot = +b.dataset.f; $('ffile').click(); });
  $('ffile').onchange = async () => {
    const f = $('ffile').files[0];
    $('ffile').value = '';
    if (!f) return;
    try {
      const url = URL.createObjectURL(f);
      F[fSlot] = await loadImg(url);
      $('f' + fSlot + 'img').src = url;
      refreshSoon();
      msg(`Frame ${fSlot === 1 ? 'utama' : 'lanjutan'} diganti.`);
    } catch (e) { msg('File frame tidak bisa dibaca.'); }
  };

  // ---------- unduh ----------
  const msg = t => { $('msg').textContent = t; };
  const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'dokumentasi';
  const pad = n => String(n).padStart(2, '0');
  let DL = null;
  (async () => { try { if (window.claude && window.claude.use) DL = await window.claude.use('downloads'); } catch (e) { DL = null; } })();

  async function save(blob, name) {
    if (DL) {
      try { await DL.save({ filename: name, data: blob }); return true; }
      catch (e) {
        const c = e && e.code;
        if (c === 'declined') { msg('Unduhan dibatalkan.'); return false; }
        if (c === 'rate_limited') { msg('Tunggu sebentar, lalu coba lagi.'); return false; }
        if (c === 'host_unavailable') { msg('Aplikasi ini tidak bisa menyimpan file. Buka halaman di browser atau komputer.'); return false; }
        if (c !== 'unavailable' && c !== 'not_granted' && c !== 'capability_disabled' && c !== 'capability_removed') { msg('Gagal mengunduh: ' + (e.message || c)); return false; }
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    return true;
  }

  async function exportOne(i, fmt, maxW) {
    const [FW, FH] = frameSize();
    const W = maxW && maxW < FW ? maxW : FW, H = Math.round(W * FH / FW);
    work.width = W; work.height = H;
    const p = photos[i], full = await decode(p.file, maxW ? Math.max(W * 1.5, 2400) : 0);
    compose(work.getContext('2d'), W, H, p, full, i);
    if (full.close) full.close();
    const png = (fmt || $('fmt').value) === 'png';
    const blob = await new Promise(r => work.toBlob(r, png ? 'image/png' : 'image/jpeg', +$('q').value));
    return { blob, name: `${pad(i + 1)}-${slug($('title').value)}.${png ? 'png' : 'jpg'}` };
  }

  const prog = v => { const p = $('prog'); p.classList.toggle('on', v !== null); p.firstElementChild.style.width = (v || 0) * 100 + '%'; };
  const busy = on => ['zipBtn', 'oneBtn'].forEach(id => $(id).disabled = on || !photos.length);

  $('oneBtn').onclick = async () => {
    busy(true); msg('Menyiapkan foto...');
    try { const f = await exportOne(sel); if (await save(f.blob, f.name)) msg(`${f.name} siap diunduh.`); }
    catch (e) { msg('Gagal membuat foto: ' + e.message); }
    busy(false);
  };
  $('zipBtn').onclick = async () => {
    busy(true); prog(0);
    try {
      const out = [];
      for (let i = 0; i < photos.length; i++) { msg(`Memproses foto ${i + 1} dari ${photos.length}...`); out.push(await exportOne(i)); prog((i + 1) / photos.length); }
      msg('Membuat ZIP...');
      const z = await zip(out), name = `${slug($('title').value)}.zip`;
      if (await save(z, name)) msg(`${photos.length} foto dalam ${name} (${(z.size / 1048576).toFixed(1)} MB).`);
    } catch (e) { msg('Gagal membuat ZIP: ' + e.message); }
    prog(null); busy(false);
  };

  // ---------- WhatsApp ----------
  const TAGS = '#TemanPemilih #KPUMelayani #BerAKHLAK #BanggaMelayaniBangsa #BalakEEE #KPUKalbar';
  let capEdited = false, shareReady = null;
  const waMsg = t => { $('waMsg').textContent = t; };
  function autoCap() {
    if (capEdited) return;
    const t = $('title').value.trim().replace(/\s+/g, ' ').toUpperCase();
    $('cap').value = `Halo, #TemanPemilih!\n\n${t ? '*' + t + '*' : '*JUDUL KEGIATAN*'}\n\n\n${TAGS}`;
  }
  $('cap').addEventListener('input', () => { capEdited = $('cap').value.trim() !== ''; shareReady = null; setShareLabel(); });
  $('title').addEventListener('input', () => { autoCap(); shareReady = null; setShareLabel(); });
  ['size', 'weight', 'shadow', 'allTitle', 'fmt', 'q'].forEach(id => $(id).addEventListener('input', () => { shareReady = null; setShareLabel(); }));
  autoCap();

  const inClaude = !!(window.claude && window.claude.use);
  const canShareFiles = (() => { try { return !inClaude && !!navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/jpeg' })], 'a.jpg', { type: 'image/jpeg' })] }); } catch (e) { return false; } })();
  function setShareLabel() {
    const b = $('shareBtn');
    if (!canShareFiles) { b.textContent = 'Bagikan (buka versi ekstensi atau situs web)'; b.disabled = true; return; }
    b.textContent = shareReady ? `Bagikan ${shareReady.length} foto ke WhatsApp` : 'Siapkan untuk WhatsApp';
  }
  if (!canShareFiles) { waMsg(inClaude ? 'Tombol Bagikan tidak tersedia di dalam claude.ai. Gunakan situs web atau ekstensi untuk berbagi langsung. Salin foto dan caption tetap bisa dipakai.' : 'Perangkat ini tidak mendukung berbagi file langsung. Gunakan Salin foto + Salin caption, atau Unduh semua.'); }
  setShareLabel();

  $('shareBtn').onclick = async () => {
    if (!canShareFiles || !photos.length) return;
    if (!shareReady) {
      $('shareBtn').disabled = true;
      try {
        const files = [];
        for (let i = 0; i < photos.length; i++) {
          waMsg(`Menyiapkan foto ${i + 1} dari ${photos.length}...`);
          const f = await exportOne(i, 'jpg');
          files.push(new File([f.blob], f.name, { type: 'image/jpeg' }));
        }
        shareReady = files;
        waMsg('Siap. Tekan tombol hijau sekali lagi, lalu pilih WhatsApp dan grupnya.');
      } catch (e) { waMsg('Gagal menyiapkan foto: ' + e.message); }
      $('shareBtn').disabled = false; setShareLabel();
      return;
    }
    try {
      await navigator.share({ files: shareReady, text: $('cap').value, title: $('title').value.trim() });
      waMsg('Terkirim ke menu Bagikan.');
    } catch (e) {
      if (e.name === 'AbortError') waMsg('Berbagi dibatalkan.');
      else waMsg('Tidak bisa membuka menu Bagikan: ' + e.message + '. Gunakan Unduh semua.');
    }
  };

  $('copyImg').onclick = async () => {
    if (!photos.length) return;
    try {
      const blobP = (async () => {
        const f = await exportOne(sel, 'png', 2400);
        return f.blob;
      })();
      waMsg('Menyalin foto...');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
      waMsg('Foto tersalin. Buka grup di WhatsApp Web, tekan Ctrl+V, lalu Kirim.');
    } catch (e) { waMsg('Browser tidak mengizinkan menyalin gambar di sini. Gunakan Unduh foto ini saja.'); }
  };
  $('copyCap').onclick = async () => {
    try { await navigator.clipboard.writeText($('cap').value); waMsg('Caption tersalin.'); }
    catch (e) { $('cap').select(); waMsg('Caption sudah dipilih; tekan Ctrl+C untuk menyalin.'); }
  };

  // ZIP sederhana (tanpa kompresi; JPG/PNG sudah terkompresi)
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  async function zip(files) {
    const enc = new TextEncoder(), parts = [], central = [], d = new Date();
    const tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    let off = 0;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, tm, true); c.setUint16(14, dt, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(c.buffer, name);
      off += 30 + name.length + data.length;
    }
    const cs = central.reduce((a, b) => a + b.byteLength, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, e.buffer], { type: 'application/zip' });
  }

  // ---------- mulai ----------
  (async () => {
    try {
      [F[1], F[2]] = await Promise.all([loadImg('frame-utama.png'), loadImg('frame-lanjutan.png')]);
      $('f1img').src = F[1].src; $('f2img').src = F[2].src;
    } catch (e) { msg('Frame bawaan tidak termuat. Gunakan tombol Ganti untuk memilih file frame.'); }
    render();
    try { await document.fonts.load('700 90px Poppins'); await document.fonts.load('500 90px Poppins'); } catch (e) { }
    if (!document.fonts.check('700 20px Poppins')) msg('Huruf Poppins belum termuat. Judul sementara memakai huruf cadangan.');
    refreshSoon();
  })();

  window.__bk = { photos, addFiles, render, exportOne, zip, sel: () => sel };
})();
