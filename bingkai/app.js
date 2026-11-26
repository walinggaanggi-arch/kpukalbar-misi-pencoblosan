(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  // Tata letak judul, diukur dari contoh resmi (frame 4000 × 2667 px):
  // Poppins Bold 67 pt (≈ 89 px), lebar maksimum ±3400 px, jarak baris 1,1×.
  // Bar media sosial pada frame utama mulai di y 2545; baseline baris terakhir = 2545 − jarak (bawaan 105 px).
  const REF_W = 4000, BAR_Y = 2545 / 2667, MAXW = 3400 / 4000, LH = 1.1;
  const DEF = { 1: null, 2: null, 3: null }, CUS = { 1: null, 2: null, 3: null }, CUSB = { 1: null, 2: null, 3: null };
  let fmode = 'kpu';

  const F = { 1: null, 2: null, 3: null };
  const ED0 = () => ({ b: 0, c: 0, s: 0, w: 0, st: 0, rot: 0, flip: false });
  let viewEnd = false;
  const endOn = () => !!F[3] && $('endOn').checked;
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

  function drawTitle(c, W, H, fr) {
    const t = $('title').value.trim();
    if (!t) return;
    const k = W / REF_W, px = (+$('size').value || 67) * 4 / 3 * k;
    c.save();
    c.font = `${$('weight').value} ${px}px Poppins, "Helvetica Neue", Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#ffffff';
    if ($('shadow').checked) { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 10 * k; c.shadowOffsetY = 4 * k; }
    const gap = (+$('gap').value || 0) * (W / REF_W), ls = wrap(c, t, MAXW * W), lh = px * LH, base = barOf(fr) * H - gap;
    ls.forEach((ln, i) => c.fillText(ln, W / 2, base - (ls.length - 1 - i) * lh));
    c.restore();
  }

  // ---------- edit foto ----------
  const hasColor = ed => !!(ed.b || ed.c || ed.s || ed.w);
  const hasEdit = ed => hasColor(ed) || !!ed.st || !!(ed.rot % 360) || !!ed.flip;
  function colorAdj(x, w, h, ed) {
    const d = x.getImageData(0, 0, w, h), a = d.data;
    const cc = ed.c * 1.28, cf = (259 * (cc + 255)) / (255 * (259 - cc)), lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) { let v = i * (1 + ed.b / 200) + ed.b * 0.5; v = cf * (v - 128) + 128; lut[i] = v; }
    const sat = 1 + ed.s / 100, wr = ed.w * 0.35;
    for (let i = 0; i < a.length; i += 4) {
      let r = lut[a[i]], g = lut[a[i + 1]], b = lut[a[i + 2]];
      if (sat !== 1) { const y = 0.299 * r + 0.587 * g + 0.114 * b; r = y + (r - y) * sat; g = y + (g - y) * sat; b = y + (b - y) * sat; }
      if (wr) { r += wr; b -= wr; }
      a[i] = r; a[i + 1] = g; a[i + 2] = b;
    }
    x.putImageData(d, 0, 0);
  }
  // Putar 90°, cermin, luruskan (dengan zoom otomatis agar sudut tidak kosong), lalu warna.
  function applyEdits(src, ed) {
    if (!ed || !hasEdit(ed)) return src;
    const r = ((ed.rot % 360) + 360) % 360, sw = src.width, sh = src.height, swap = r === 90 || r === 270;
    const w = swap ? sh : sw, h = swap ? sw : sh;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.translate(w / 2, h / 2);
    const th = ed.st * Math.PI / 180;
    if (th) { const a = Math.abs(th), k = Math.max(Math.cos(a) + (h / w) * Math.sin(a), Math.cos(a) + (w / h) * Math.sin(a)); x.rotate(th); x.scale(k, k); }
    if (ed.flip) x.scale(-1, 1);
    x.rotate(r * Math.PI / 180);
    x.drawImage(src, -sw / 2, -sh / 2);
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (hasColor(ed)) colorAdj(x, w, h, ed);
    return c;
  }
  function procPrev(p) {
    const key = JSON.stringify(p.ed);
    if (p.procKey !== key) { p.proc = applyEdits(p.prev, p.ed); p.procKey = key; }
    return p.proc;
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
    if (fn === 1 || $('allTitle').checked) drawTitle(c, W, H, fr);
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
    syncFrameBtns();
    syncEdit();
    if (!ok) {
      ctx.clearRect(0, 0, W, H);
      if (F[1]) { ctx.globalAlpha = .9; ctx.drawImage(F[1], 0, 0, W, H); ctx.globalAlpha = 1; drawTitle(ctx, W, H, F[1]); }
      return;
    }
    if (viewEnd && endOn()) { ctx.drawImage(F[3], 0, 0, W, H); syncEdit(); return; }
    viewEnd = false;
    const p = photos[sel];
    $('zoom').value = p.zoom;
    compose(ctx, W, H, p, procPrev(p), sel);
  }

  function thumb(i) {
    const p = photos[i], c = p.tc, [FW, FH] = frameSize();
    c.width = 300; c.height = Math.round(300 * FH / FW);
    compose(c.getContext('2d'), c.width, c.height, p, procPrev(p), i);
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
      d.onclick = () => { if (justDragged) return; sel = i; viewEnd = false; renderList(); render(); };
      d.dataset.idx = i;
      d.addEventListener('pointerdown', e => dragStart(e, i, d));
      d.addEventListener('contextmenu', e => e.preventDefault());
      d.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.click(); } };
      list.insertBefore(d, $('count'));
      thumb(i);
    });
    if (photos.length && endOn()) {
      const d = document.createElement('div'), c = document.createElement('canvas'), [FW, FH] = frameSize();
      d.className = 'th end' + (viewEnd ? ' sel' : ''); d.tabIndex = 0; d.setAttribute('role', 'button'); d.setAttribute('aria-label', 'Slide penutup');
      c.width = 300; c.height = Math.round(300 * FH / FW); c.getContext('2d').drawImage(F[3], 0, 0, c.width, c.height);
      const n = document.createElement('span'); n.className = 'n u3'; n.textContent = `${photos.length + 1} · Penutup`;
      d.append(c, n);
      d.onclick = () => { viewEnd = true; renderList(); render(); };
      d.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.click(); } };
      list.insertBefore(d, $('count'));
    }
    const nu = photos.filter((p, i) => frameOf(p, i) === 1).length;
    $('count').textContent = photos.length ? `${photos.length} foto · ${nu} utama + ${photos.length - nu} lanjutan${endOn() ? ' + penutup' : ''}` : '';
    $('addMore').hidden = !photos.length;
    syncFrameBtns();
  }
  function syncFrameBtns() {
    ['reset', 'left', 'right', 'first', 'del', 'zoom'].forEach(id => $(id).disabled = !photos.length || viewEnd);
    const ok = photos.length > 0 && !viewEnd, f = ok ? frameOf(photos[sel], sel) : 0;
    $('fr1').setAttribute('aria-pressed', f === 1); $('fr2').setAttribute('aria-pressed', f === 2);
    $('fr1').disabled = $('fr2').disabled = !ok;
  }
  const setFrame = n => { if (!photos.length) return; photos[sel].frame = n; renderList(); render(); };
  $('fr1').onclick = () => setFrame(1);
  $('fr2').onclick = () => setFrame(2);
  $('addMore').onclick = () => $('file').click();

  // ---------- seret untuk mengubah urutan ----------
  let dragS = null, justDragged = false;
  const photoThumbs = () => [...$('list').querySelectorAll('.th:not(.end)')];
  function dragStart(e, i, el) {
    if (e.button > 0) return;
    dragS = { i, el, x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType !== 'mouse', active: false, timer: 0, k: -1 };
    if (dragS.touch) dragS.timer = setTimeout(() => { if (dragS && !dragS.active) activate(dragS.x, dragS.y); }, 350);
  }
  function activate(x, y) {
    const ths = photoThumbs();
    dragS.active = true;
    dragS.horiz = ths.length > 1 && Math.abs(ths[1].getBoundingClientRect().top - ths[0].getBoundingClientRect().top) < 10;
    $('list').classList.toggle('horiz', dragS.horiz);
    dragS.el.classList.add('dragging');
    document.body.classList.add('dragging-photo');
    const g = document.createElement('div'), c = document.createElement('canvas'), src = photos[dragS.i].tc;
    g.className = 'ghost'; c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0);
    g.append(c); document.body.append(g); dragS.ghost = g;
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { }
    dragMove(x, y);
  }
  function dragMove(x, y) {
    const g = dragS.ghost; g.style.left = x + 'px'; g.style.top = y + 'px';
    const ths = photoThumbs(), pos = dragS.horiz ? x : y;
    let k = 0;
    ths.forEach(t => { const r = t.getBoundingClientRect(); if ((dragS.horiz ? r.left + r.width / 2 : r.top + r.height / 2) < pos) k++; });
    dragS.k = k;
    ths.forEach(t => t.classList.remove('drop-b', 'drop-a'));
    const to = k > dragS.i ? k - 1 : k;
    if (to !== dragS.i) { if (k < ths.length) ths[k].classList.add('drop-b'); else ths[ths.length - 1].classList.add('drop-a'); }
    const L = $('list'), r = L.getBoundingClientRect(), edge = 48, sp = 14;
    if (dragS.horiz) { if (x < r.left + edge) L.scrollLeft -= sp; else if (x > r.right - edge) L.scrollLeft += sp; }
    else { if (y < r.top + edge) L.scrollTop -= sp; else if (y > r.bottom - edge) L.scrollTop += sp; }
  }
  function dragEnd(commit) {
    if (!dragS) return;
    clearTimeout(dragS.timer);
    const d = dragS; dragS = null;
    if (!d.active) return;
    d.ghost.remove();
    document.body.classList.remove('dragging-photo');
    photoThumbs().forEach(t => t.classList.remove('drop-b', 'drop-a', 'dragging'));
    justDragged = true; setTimeout(() => { justDragged = false; }, 50);
    if (!commit || d.k < 0) return;
    const to = d.k > d.i ? d.k - 1 : d.k;
    if (to === d.i) return;
    const selP = photos[sel], [p] = photos.splice(d.i, 1);
    photos.splice(to, 0, p);
    sel = Math.max(0, photos.indexOf(selP));
    renderList(); render();
    msg(`Foto dipindah ke urutan ${to + 1}.`);
  }
  document.addEventListener('pointermove', e => {
    if (!dragS || e.pointerId !== dragS.id) return;
    const dist = Math.hypot(e.clientX - dragS.x, e.clientY - dragS.y);
    if (!dragS.active) {
      if (dragS.touch) { if (dist > 10) { clearTimeout(dragS.timer); dragS = null; } return; }
      if (dist < 6) return;
      activate(e.clientX, e.clientY);
      return;
    }
    dragMove(e.clientX, e.clientY);
  });
  document.addEventListener('pointerup', e => { if (dragS && e.pointerId === dragS.id) dragEnd(true); });
  document.addEventListener('pointercancel', e => { if (dragS && e.pointerId === dragS.id) dragEnd(false); });
  document.addEventListener('touchmove', e => { if (dragS && dragS.active) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && dragS) dragEnd(false); });

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
        photos.push({ id: ++uid, file: f, prev, zoom: 1, ox: 0, oy: 0, ed: ED0(), tc: document.createElement('canvas') });
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

  ['title', 'size', 'weight', 'shadow', 'allTitle', 'gap'].forEach(id => $(id).addEventListener('input', refreshSoon));
  $('gap').addEventListener('input', () => { $('gapV').textContent = $('gap').value + ' px'; });
  $('endOn').addEventListener('input', () => { if (!$('endOn').checked) viewEnd = false; renderList(); render(); });

  // ---------- panel edit ----------
  const EDS = [['eB', 'b', 'oB', ''], ['eC', 'c', 'oC', ''], ['eS', 's', 'oS', ''], ['eW', 'w', 'oW', ''], ['eT', 'st', 'oT', '°']];
  const fmtV = (v, u) => (v > 0 ? '+' : '') + v + u;
  function syncEdit() {
    const ok = photos.length > 0 && !viewEnd, ed = ok ? photos[sel].ed : ED0();
    EDS.forEach(([id, k, o, u]) => { $(id).value = ed[k]; $(o).textContent = fmtV(ed[k], u); $(id).disabled = !ok; });
    ['rotL', 'rotR', 'flip', 'edReset', 'edAll'].forEach(id => $(id).disabled = !ok);
    $('flip').setAttribute('aria-pressed', String(!!ed.flip));
  }
  let eT = 0;
  const edChanged = () => { clearTimeout(eT); eT = setTimeout(refreshSoon, 30); };
  EDS.forEach(([id, k, o, u]) => {
    $(id).addEventListener('input', e => { if (!photos.length || viewEnd) return; photos[sel].ed[k] = +e.target.value; $(o).textContent = fmtV(+e.target.value, u); edChanged(); });
    $(id).addEventListener('dblclick', () => { if (!photos.length || viewEnd) return; photos[sel].ed[k] = 0; edChanged(); });
  });
  $('rotL').onclick = () => { const p = photos[sel]; p.ed.rot = (p.ed.rot + 270) % 360; p.ox = p.oy = 0; refreshSoon(); };
  $('rotR').onclick = () => { const p = photos[sel]; p.ed.rot = (p.ed.rot + 90) % 360; p.ox = p.oy = 0; refreshSoon(); };
  $('flip').onclick = () => { const p = photos[sel]; p.ed.flip = !p.ed.flip; refreshSoon(); };
  $('edReset').onclick = () => { photos[sel].ed = ED0(); refreshSoon(); };
  $('edAll').onclick = () => { const e = photos[sel].ed; photos.forEach(p => { p.ed = { ...p.ed, b: e.b, c: e.c, s: e.s, w: e.w }; }); refreshSoon(); msg(`Warna foto ${sel + 1} diterapkan ke ${photos.length} foto.`); };

  // ---------- frame ----------
  // Deteksi batas atas bar media sosial: dari bawah ke atas, baris yang buram (alpha tinggi) di bagian tengah frame.
  function detectBar(img) {
    if (!img || img._bar !== undefined) return img ? img._bar : null;
    try {
      const w = 500, h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data, x0 = Math.round(w * .38), x1 = Math.round(w * .62);
      const frac = y => { let n = 0; for (let i = x0; i < x1; i++) if (d[(y * w + i) * 4 + 3] >= 230) n++; return n / (x1 - x0); };
      let y = h - 2;
      if (frac(y) < .6) { img._bar = null; }
      else { while (y > h * .5 && frac(y) >= .6) y--; img._bar = (y + 1) / h; }
      const cy = Math.round(h * .45), cx = Math.round(w * .5); img._opaqueCenter = d[(cy * w + cx) * 4 + 3] > 200;
    } catch (e) { img._bar = null; }
    return img._bar;
  }
  function barOf(fr) {
    const f = fr || F[1];
    if (!f) return BAR_Y;
    const b = detectBar(f);
    return b == null ? 0.97 : b;
  }
  function applyFrames() {
    [1, 2, 3].forEach(n => {
      F[n] = (fmode === 'saya' && CUS[n]) || DEF[n];
      const im = $('f' + n + 'img');
      if (F[n]) im.src = F[n].src;
      im.parentElement.classList.toggle('cus', fmode === 'saya' && !!CUS[n]);
    });
    document.querySelectorAll('input[name=fmode]').forEach(r => r.checked = r.value === fmode);
    $('fClear').hidden = !(CUS[1] || CUS[2] || CUS[3]);
    const b = detectBar(F[1]), H = F[1] ? F[1].naturalHeight : 2667;
    $('barInfo').textContent = F[1] ? (b == null ? 'Bar media sosial tidak terdeteksi pada frame utama; judul ditempatkan dari tepi bawah gambar.' : `Bar media sosial frame utama terdeteksi di y ${Math.round(b * H)} dari ${H} px.`) : '';
    if (!$('endOn').dataset.user) $('endOn').checked = !!F[3];
    shareReady = null; setShareLabel();
    renderList(); refreshSoon();
  }
  // Penyimpanan frame saya (IndexedDB, hanya di perangkat ini)
  const idb = () => new Promise((res, rej) => { try { const r = indexedDB.open('bingkai-dokumentasi', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
  async function idbSet(k, v) { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { } }
  async function idbGet(k) { try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { return undefined; } }
  const saveFrames = () => idbSet('frames', { mode: fmode, 1: CUSB[1], 2: CUSB[2], 3: CUSB[3] });
  async function loadFrames() {
    const v = await idbGet('frames');
    if (!v) return;
    for (const n of [1, 2, 3]) if (v[n] instanceof Blob) { try { CUSB[n] = v[n]; CUS[n] = await loadImg(URL.createObjectURL(v[n])); } catch (e) { } }
    if (v.mode === 'saya' && (CUS[1] || CUS[2] || CUS[3])) fmode = 'saya';
  }
  const fMsg = t => { $('fMsg').textContent = t; };
  let fSlot = 1;
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { fSlot = +b.dataset.f; $('ffile').click(); });
  $('ffile').onchange = async () => {
    const f = $('ffile').files[0];
    $('ffile').value = '';
    if (!f) return;
    try {
      const img = await loadImg(URL.createObjectURL(f));
      CUS[fSlot] = img; CUSB[fSlot] = f; fmode = 'saya';
      applyFrames(); saveFrames();
      const nm = fSlot === 3 ? 'Slide penutup' : `Frame ${fSlot === 1 ? 'utama' : 'lanjutan'}`;
      let note = '';
      if (fSlot !== 3) {
        detectBar(img);
        if (img._opaqueCenter) note += ' Perhatian: bagian tengah frame tidak transparan, foto akan tertutup.';
        const [FW, FH] = frameSize();
        if (Math.abs(img.naturalWidth / img.naturalHeight - FW / FH) > 0.02) note += ` Rasio frame berbeda dengan frame utama (${FW}×${FH}); frame akan direntangkan.`;
        if (fSlot === 1) note += img._bar == null ? ' Bar media sosial tidak terdeteksi; judul ditempatkan dari tepi bawah.' : ` Bar terdeteksi di y ${Math.round(img._bar * img.naturalHeight)} px; jarak judul ke bar tetap sama (menyesuaikan ukuran frame).`;
      }
      fMsg(`${nm} milikmu dipakai dan disimpan di perangkat ini.${note}`);
    } catch (e) { fMsg('File tidak bisa dibaca. Gunakan PNG atau JPG.'); }
  };
  document.querySelectorAll('input[name=fmode]').forEach(r => r.addEventListener('change', () => {
    fmode = r.value;
    if (fmode === 'saya' && !(CUS[1] || CUS[2] || CUS[3])) fMsg('Belum ada frame milikmu. Klik Unggah pada Utama, Lanjutan, atau Slide penutup.');
    else fMsg(fmode === 'saya' ? 'Memakai frame milikmu.' : 'Memakai frame KPU Kalbar bawaan.');
    applyFrames(); saveFrames();
  }));
  $('fClear').onclick = () => {
    CUS[1] = CUS[2] = CUS[3] = null; CUSB[1] = CUSB[2] = CUSB[3] = null; fmode = 'kpu';
    applyFrames(); saveFrames(); fMsg('Frame milikmu dihapus. Kembali ke frame KPU Kalbar bawaan.');
  };
  $('endOn').addEventListener('change', () => { $('endOn').dataset.user = '1'; });

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
    const p = photos[i], full = await decode(p.file, maxW ? Math.max(W * 1.5, 2400) : 4800), img = applyEdits(full, p.ed);
    compose(work.getContext('2d'), W, H, p, img, i);
    if (full.close) full.close();
    const png = (fmt || $('fmt').value) === 'png';
    const blob = await new Promise(r => work.toBlob(r, png ? 'image/png' : 'image/jpeg', +$('q').value));
    return { blob, name: `${pad(i + 1)}-${slug($('title').value)}.${png ? 'png' : 'jpg'}` };
  }

  async function exportEnd(n, fmt, maxW) {
    const [FW, FH] = frameSize();
    const W = maxW && maxW < FW ? maxW : FW, H = Math.round(W * FH / FW);
    work.width = W; work.height = H;
    const c = work.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(F[3], 0, 0, W, H);
    const png = (fmt || $('fmt').value) === 'png';
    const blob = await new Promise(r => work.toBlob(r, png ? 'image/png' : 'image/jpeg', +$('q').value));
    return { blob, name: `${pad(n)}-penutup.${png ? 'png' : 'jpg'}` };
  }

  const prog = v => { const p = $('prog'); p.classList.toggle('on', v !== null); p.firstElementChild.style.width = (v || 0) * 100 + '%'; };
  const busy = on => ['zipBtn', 'oneBtn'].forEach(id => $(id).disabled = on || !photos.length);

  $('oneBtn').onclick = async () => {
    busy(true); msg('Menyiapkan foto...');
    try { const f = viewEnd ? await exportEnd(photos.length + 1) : await exportOne(sel); if (await save(f.blob, f.name)) msg(`${f.name} siap diunduh.`); }
    catch (e) { msg('Gagal membuat foto: ' + e.message); }
    busy(false);
  };
  $('zipBtn').onclick = async () => {
    busy(true); prog(0);
    try {
      const out = [];
      const tot = photos.length + (endOn() ? 1 : 0);
      for (let i = 0; i < photos.length; i++) { msg(`Memproses foto ${i + 1} dari ${tot}...`); out.push(await exportOne(i)); prog((i + 1) / tot); }
      if (endOn()) { out.push(await exportEnd(photos.length + 1)); prog(1); }
      msg('Membuat ZIP...');
      const z = await zip(out), name = `${slug($('title').value)}.zip`;
      if (await save(z, name)) msg(`${out.length} gambar dalam ${name} (${(z.size / 1048576).toFixed(1)} MB).`);
    } catch (e) { msg('Gagal membuat ZIP: ' + e.message); }
    prog(null); busy(false);
  };

  // ---------- posting ke media sosial ----------
  const TAGS = '#TemanPemilih #KPUMelayani #BerAKHLAK #BanggaMelayaniBangsa #BalakEEE #KPUKalbar';
  const PF = {
    wa: { n: 'WhatsApp', max: 0, lim: 0, open: 'Buka WhatsApp Web', url: () => 'https://web.whatsapp.com/',
      tip: 'HP/Windows: Siapkan foto → Bagikan → pilih WhatsApp dan grupnya; caption ikut terkirim. WhatsApp Web: Salin foto ini → Ctrl+V di grup → tempel caption. Tanda *bintang* = huruf tebal.' },
    ig: { n: 'Instagram', max: 2200, lim: 20, open: 'Buka Meta Business Suite', url: () => 'https://business.facebook.com/latest/composer',
      tip: 'Maksimal 20 foto per postingan. HP: Bagikan → pilih Instagram (Feed) → tempel caption (sudah tersalin otomatis). Laptop: unggah foto dari ZIP lewat Meta Business Suite, bisa sekaligus ke Facebook.' },
    fb: { n: 'Facebook', max: 63206, lim: 0, open: 'Buka Meta Business Suite', url: () => 'https://business.facebook.com/latest/composer',
      tip: 'HP: Bagikan → pilih Facebook atau Meta Business Suite → pilih Page KPU Provinsi Kalimantan Barat → tempel caption. Laptop: unggah foto dari ZIP lewat Meta Business Suite.' },
    x: { n: 'X', max: 280, lim: 4, open: 'Buka X (caption terisi)', url: c => 'https://x.com/intent/post?text=' + encodeURIComponent(c),
      tip: 'Maksimal 4 foto dan 280 karakter; caption dipendekkan otomatis. Saat dibagikan dikirim 3 foto pertama + slide penutup. Tombol Buka X langsung mengisi teks; lampirkan fotonya di sana.' },
    tt: { n: 'TikTok', max: 4000, lim: 35, open: 'Buka TikTok Studio', url: () => 'https://www.tiktok.com/tiktokstudio/upload',
      tip: 'Mode foto TikTok memuat maksimal 35 foto. HP: Bagikan → pilih TikTok → tempel caption (sudah tersalin otomatis). Laptop: unggah lewat TikTok Studio.' }
  };
  let cur = 'wa', shareReady = null;
  const edited = {};
  const waMsg = t => { $('waMsg').textContent = t; };
  const clen = s => [...s].length;
  const cut = (s, n) => clen(s) <= n ? s : [...s].slice(0, Math.max(0, n - 1)).join('').trimEnd() + '…';
  function buildCap(pf) {
    const T = $('title').value.trim().replace(/\s+/g, ' ').toUpperCase() || 'JUDUL KEGIATAN', D = $('desc').value.trim();
    if (pf === 'wa') return `Halo, #TemanPemilih!\n\n*${T}*${D ? '\n\n' + D : ''}\n\n${TAGS}`;
    if (pf === 'x') {
      const hello = 'Halo, #TemanPemilih!\n\n';
      let tg = ['#KPUKalbar', '#KPUMelayani', '#BerAKHLAK'];
      const tail = () => '\n\n' + tg.join(' ');
      let head = hello + T;
      while (tg.length > 1 && clen(head + tail()) > 280) tg.pop();
      if (clen(head + tail()) > 280) head = hello + cut(T, 280 - clen(hello) - clen(tail()));
      if (D) { const room = 280 - clen(head + tail()) - 2; if (room > 24) head += '\n\n' + cut(D, room); }
      return head + tail();
    }
    return `Halo, #TemanPemilih!\n\n${T}${D ? '\n\n' + D : ''}\n\n${TAGS}`;
  }
  const capOf = pf => edited[pf] != null ? edited[pf] : buildCap(pf);
  function updCount() {
    const v = $('cap').value, m = PF[cur].max, n = clen(v), c = $('capCount');
    c.textContent = m ? `${n} / ${m}` : `${n} karakter`;
    c.classList.toggle('over', !!m && n > m);
    $('openPf').href = PF[cur].url(v);
  }
  function renderPf() {
    document.querySelectorAll('.ptabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pf === cur)));
    $('pfName').textContent = 'untuk ' + PF[cur].n;
    $('cap').value = capOf(cur);
    $('pfTip').textContent = PF[cur].tip;
    $('openPf').textContent = PF[cur].open;
    updCount(); setShareLabel();
  }
  document.querySelectorAll('.ptabs button').forEach(b => b.onclick = () => { cur = b.dataset.pf; renderPf(); });
  $('cap').addEventListener('input', () => { edited[cur] = $('cap').value; updCount(); });
  $('capReset').onclick = () => { delete edited[cur]; renderPf(); waMsg(`Caption ${PF[cur].n} disusun ulang dari judul dan keterangan.`); };
  ['title', 'desc'].forEach(id => $(id).addEventListener('input', () => { if (edited[cur] == null) { $('cap').value = buildCap(cur); updCount(); } }));
  ['size', 'weight', 'shadow', 'allTitle', 'gap', 'fmt', 'q'].forEach(id => $(id).addEventListener('input', () => { shareReady = null; setShareLabel(); }));

  const inClaude = !!(window.claude && window.claude.use);
  const canShareFiles = (() => { try { return !inClaude && !!navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/jpeg' })], 'a.jpg', { type: 'image/jpeg' })] }); } catch (e) { return false; } })();
  function pickFiles(all) {
    const lim = PF[cur].lim;
    if (!lim || all.length <= lim) return all;
    const hasEnd = endOn() && /-penutup\.jpg$/.test(all[all.length - 1].name);
    return hasEnd ? [...all.slice(0, lim - 1), all[all.length - 1]] : all.slice(0, lim);
  }
  function setShareLabel() {
    const b = $('shareBtn');
    if (!canShareFiles) { b.textContent = 'Bagikan (buka di HP, situs web, atau ekstensi)'; b.disabled = true; return; }
    b.disabled = !photos.length;
    b.textContent = shareReady ? `Bagikan ${pickFiles(shareReady).length} gambar ke ${PF[cur].n}` : 'Siapkan foto untuk dibagikan';
  }
  if (!canShareFiles) waMsg(inClaude ? 'Di dalam claude.ai tombol Bagikan tidak tersedia. Gunakan Salin caption + Buka, atau situs web/ekstensi.' : 'Perangkat ini tidak mendukung berbagi file langsung. Gunakan Unduh semua, lalu Salin caption + Buka platform.');

  async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } }
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
        if (endOn()) { const f = await exportEnd(photos.length + 1, 'jpg'); files.push(new File([f.blob], f.name, { type: 'image/jpeg' })); }
        shareReady = files;
        waMsg(`Siap. Tekan tombol sekali lagi untuk membagikan ke ${PF[cur].n}. Ganti tab platform kapan saja tanpa menyiapkan ulang.`);
      } catch (e) { waMsg('Gagal menyiapkan foto: ' + e.message); }
      setShareLabel();
      return;
    }
    const text = $('cap').value, files = pickFiles(shareReady);
    const copied = await copyText(text);
    try {
      await navigator.share({ files, text, title: $('title').value.trim() });
      waMsg(cur === 'wa' ? 'Terkirim ke menu Bagikan.' : `Menu Bagikan dibuka. ${copied ? 'Caption sudah tersalin; tempel di kolom keterangan ' + PF[cur].n + '.' : 'Salin caption dengan tombol Salin caption.'}`);
    } catch (e) {
      if (e.name === 'AbortError') waMsg('Berbagi dibatalkan.');
      else waMsg('Tidak bisa membuka menu Bagikan: ' + e.message + '. Gunakan Unduh semua.');
    }
  };
  $('openPf').addEventListener('click', async () => {
    const ok = await copyText($('cap').value);
    waMsg(ok ? `Caption tersalin. Di ${PF[cur].n}, unggah foto dari ZIP lalu tempel caption (Ctrl+V).` : 'Halaman dibuka. Salin caption dengan tombol Salin caption.');
  });
  $('copyImg').onclick = async () => {
    if (!photos.length) return;
    try {
      const blobP = (async () => {
        const f = viewEnd ? await exportEnd(photos.length + 1, 'png', 2400) : await exportOne(sel, 'png', 2400);
        return f.blob;
      })();
      waMsg('Menyalin foto...');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
      waMsg('Foto tersalin. Tempel (Ctrl+V) di WhatsApp Web atau kolom unggah platform.');
    } catch (e) { waMsg('Browser tidak mengizinkan menyalin gambar di sini. Gunakan Unduh foto ini saja.'); }
  };
  $('copyCap').onclick = async () => {
    if (await copyText($('cap').value)) waMsg(`Caption ${PF[cur].n} tersalin.`);
    else { $('cap').select(); waMsg('Caption sudah dipilih; tekan Ctrl+C untuk menyalin.'); }
  };
  renderPf();

  // ---------- info sudah posting ----------
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const KECIL = new Set(['dan', 'di', 'ke', 'dari', 'yang', 'untuk', 'pada', 'dengan', 'atau', 'serta', 'dalam', 'oleh', 'bagi', 'tentang', 'terhadap', 'sebagai', 'antara', 'atas', 'melalui']);
  const KEEP_UP = new Set(['KPU', 'RI', 'JDIH', 'PPID', 'DPT', 'DPTB', 'DPK', 'DPS', 'KPPS', 'PPK', 'PPS', 'TPS', 'PPDP', 'DPR', 'DPRD', 'DPD', 'PKPU', 'SK', 'SDM', 'TIK', 'IT', 'ASN', 'PNS', 'PPPK', 'BPS', 'OPD', 'LHKPN', 'SIPOL', 'SILON', 'SIREKAP', 'SIDALIH', 'SAKIP', 'LAKIP', 'RKA', 'DIPA', 'BMN', 'SPIP', 'ZI', 'WBK', 'WBBM', 'HUT', 'UU', 'PP', 'TNI', 'POLRI', 'POLDA', 'POLRES', 'DKPP', 'MK', 'MA', 'PTUN', 'KIP', 'SMA', 'SMK', 'SMP', 'SD', 'MAN', 'UIN', 'IAIN', 'OSIS', 'BEM', 'UKM', 'RT', 'RW', 'LSM', 'NGO', 'FGD']);
  const ROMAWI = /^(?=[IVXLC]+$)M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})$/;
  function capWord(w, first) {
    const m = w.match(/^([^A-Za-z0-9]*)([A-Za-z0-9]+)(.*)$/);
    if (!m) return w;
    const [, pre, core, post] = m, up = core.toUpperCase();
    const inParen = pre.includes('(') && /\)/.test(post) && /^[A-Z]{2,8}$/.test(up);
    if (KEEP_UP.has(up) || inParen || /\d/.test(core) && /[A-Z]/i.test(core) && core.length <= 6 || (ROMAWI.test(up) && up.length <= 4 && up !== 'DI' && up !== 'MI')) return pre + up + post.replace(/[A-Za-z]+/g, t => capWord(t, false));
    const low = core.toLowerCase();
    if (!first && KECIL.has(low)) return pre + low + post;
    if (!first && low === 'se' && post.startsWith('-')) return pre + 'se' + post.replace(/([\/\-])([A-Za-z]+)/g, (_, sep, t) => sep + capWord(t, false));
    const out = low.charAt(0).toUpperCase() + low.slice(1);
    return pre + out + post.replace(/([\/\-])([A-Za-z]+)/g, (_, sep, t) => sep + capWord(t, false));
  }
  function titleCase(t) {
    t = t.trim().replace(/\s+/g, ' ');
    if (!t) return '';
    if (t !== t.toUpperCase()) return t;
    return t.split(' ').map((w, i) => capWord(w, i === 0)).join(' ');
  }
  function salamAuto(d) { const h = d.getHours(); return h < 11 ? 'Pagi' : h < 15 ? 'Siang' : h < 18 ? 'Sore' : 'Malam'; }
  function tglText(v) {
    const d = v ? new Date(v + 'T12:00:00') : new Date();
    return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  }
  const cleanUrl = u => { u = u.trim(); if (!u) return ''; if (!$('iClean').checked) return u; try { const x = new URL(u); x.search = ''; x.hash = ''; return x.toString(); } catch (e) { return u.split('?')[0]; } };
  const LINKS = [['lIG', 'Instagram'], ['lFB', 'Facebook'], ['lX', 'X'], ['lTT', 'TikTok'], ['lYT', 'YouTube']];
  let iTitleEdited = false, iMsgEdited = false;
  function buildInfo() {
    const salam = $('iSalam').value === 'auto' ? salamAuto(new Date()) : $('iSalam').value;
    const judul = $('iTitle').value.trim() || 'Judul Kegiatan';
    const links = LINKS.map(([id, n]) => [n, cleanUrl($(id).value)]).filter(([, u]) => u);
    const ls = links.length ? links.map(([n, u]) => `*${n}*\n${u}`).join('\n\n') : '*Instagram*\n(tempel tautan)\n\n*Facebook*\n(tempel tautan)\n\n*X*\n(tempel tautan)';
    return `Selamat *${salam}*\nYth Bapak/Ibu\nSalam HUMAS\n\nMohon ijin membagikan postingan dari Medsos KPU Provinsi Kalimantan Barat *${tglText($('iDate').value)}.*\n\n*${judul}*\n\nCek postingan berikut….\n\n${ls}\n\nJangan lupa like, komen, dan share juga ya Bapak/Ibu ♥️\nTerimakasih🙏\n\n#KPUMelayani\n#Berakhlak\n#BanggaMelayaniBangsa\n#BalakEEE`;
  }
  function renderInfo() {
    if (!iTitleEdited) $('iTitle').value = titleCase($('title').value);
    if (!iMsgEdited) $('iMsg').value = buildInfo();
    $('iWa').href = 'https://wa.me/?text=' + encodeURIComponent($('iMsg').value);
  }
  (() => { const d = new Date(), z = n => String(n).padStart(2, '0'); $('iDate').value = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; })();
  $('title').addEventListener('input', renderInfo);
  $('iTitle').addEventListener('input', () => { iTitleEdited = $('iTitle').value.trim() !== ''; renderInfo(); });
  ['iSalam', 'iDate', 'iClean', ...LINKS.map(l => l[0])].forEach(id => $(id).addEventListener('input', renderInfo));
  $('iMsg').addEventListener('input', () => { iMsgEdited = true; $('iWa').href = 'https://wa.me/?text=' + encodeURIComponent($('iMsg').value); });
  $('iReset').onclick = () => { iTitleEdited = false; iMsgEdited = false; renderInfo(); $('iInfo').textContent = 'Pesan disusun ulang.'; };
  $('iCopy').onclick = async () => { renderInfo(); if (await copyText($('iMsg').value)) $('iInfo').textContent = 'Pesan tersalin. Tempel di grup WhatsApp.'; else { $('iMsg').select(); $('iInfo').textContent = 'Pesan sudah dipilih; tekan Ctrl+C.'; } };
  $('iWa').addEventListener('click', () => { $('iInfo').textContent = 'Membuka WhatsApp. Pilih grup, lalu kirim.'; });
  setInterval(() => { if ($('iSalam').value === 'auto' && !iMsgEdited) renderInfo(); }, 60000);
  renderInfo();

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

  if (/github\.io$/.test(location.hostname)) $('extLink').hidden = false;

  // ---------- mulai ----------
  (async () => {
    try {
      [DEF[1], DEF[2]] = await Promise.all([loadImg('frame-utama.png'), loadImg('frame-lanjutan.png')]);
    } catch (e) { msg('Frame bawaan tidak termuat. Gunakan pilihan Frame saya untuk mengunggah frame.'); }
    try { DEF[3] = await loadImg('penutup.jpg'); } catch (e) { }
    await loadFrames();
    applyFrames();
    render();
    try { await document.fonts.load('700 90px Poppins'); await document.fonts.load('500 90px Poppins'); } catch (e) { }
    if (!document.fonts.check('700 20px Poppins')) msg('Huruf Poppins belum termuat. Judul sementara memakai huruf cadangan.');
    refreshSoon();
  })();

  window.__bk = { photos, addFiles, render, exportOne, zip, sel: () => sel };
})();
