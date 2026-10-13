/* =========================================================
   Home hero: cursor-controlled dry-brush "scratch to reveal"
   Image 1 (cartoon, default) sits on a canvas above Image 2 (tech version).
   Every frame the canvas is rebuilt: draw image 1, then erase it with
   all live brush stamps (destination-out). Stamps SHRINK over ~2.7 s
   (no opacity fade), so nothing ghosts. Nothing reveals until the user moves.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Settings (tweak these) ---------- */
  const IMG_TOP    = 'assets/images/hero-1.jpg';   // default image (top layer)
  const IMG_BOTTOM = 'assets/images/hero-2.jpg';   // hidden image (bottom layer)
  const LIFETIME     = 2.7;    // seconds each stamp lives
  const BRUSH_FACTOR = 0.17;   // brush radius = this x smaller viewport side
  const SPACING      = 0.09;   // stamp spacing = this x brush radius (small = continuous stroke)
  const FOLLOW       = 0.17;   // cursor smoothing
  const SAMPLES      = 48;     // perimeter points per brush shape
  const MAX_DPR      = 2;

  const hero  = document.getElementById('hero');
  if (!hero) return;
  const under = document.getElementById('hero-under');
  const cvs   = document.getElementById('hero-top');
  const ctx   = cvs.getContext('2d');
  const hint  = document.querySelector('.hero-hint');
  const errEl = document.querySelector('.hero-error');

  if (window.matchMedia('(pointer: coarse)').matches && hint) hint.textContent = 'Drag to scratch';

  /* ---------- State ---------- */
  let img1 = null, W = 0, H = 0, dpr = 1;
  let stamps = [];
  let active = false;                 // pointer is inside the hero and controlling the brush
  let tx = 0, ty = 0;                 // real pointer
  let sx = 0, sy = 0;                 // smoothed follower
  let lastX = 0, lastY = 0, hasLast = false;
  let dirAngle = 0, hasDir = false, speedNorm = 0;
  let slits = [];
  let lastT = performance.now();

  /* ---------- Helpers ---------- */
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); }

  // Organic, torn brush outline: several noise frequencies + bites + spikes
  function makeShape(seed, time) {
    const out = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      const a = (i / SAMPLES) * Math.PI * 2;
      let r = 1
        + 0.085 * Math.sin(3 * a + time + seed)
        + 0.048 * Math.sin(5 * a - time * 1.15 + seed * 2.1)
        + 0.022 * Math.sin(9 * a + time * 0.6 + seed * 3.7);
      r += (hash(seed * 13.7 + i * 1.913) - 0.5) * 0.07;
      r += (hash(seed * 7.3 + i * 0.37) - 0.5) * 0.035 * Math.sin(17 * a + seed);
      const t = hash(seed * 3.1 + i * 5.77);
      if (t > 0.93) r -= 0.10 + hash(seed + i) * 0.10;            // torn notch
      else if (t < 0.05) r += 0.06 + hash(seed * 2 + i) * 0.07;   // rough protrusion
      out[i] = r;
    }
    return out;
  }

  // Thin elongated gaps (dry-brush streaks), never perfect circles
  function makeSlits(seed) {
    const list = [], n = 4 + Math.floor(hash(seed) * 3);
    for (let i = 0; i < n; i++) {
      list.push({
        lat: (hash(seed + i * 2.3) - 0.5) * 1.1, pos: (hash(seed + i * 4.1) - 0.5) * 0.35,
        len: 0.55 + hash(seed + i * 6.7) * 0.35, wid: 0.012 + hash(seed + i * 8.9) * 0.022,
        rot: (hash(seed + i * 1.1) - 0.5) * 0.08
      });
    }
    return list;
  }

  function addStamp(x, y, angle, radius, now) {
    const seed = Math.random() * 1000;
    stamps.push({
      x, y, angle, r: radius, born: now, seed,
      shape: makeShape(seed, now * 0.001),
      stretch: 1 + 0.16 * Math.min(1, speedNorm * 1.2) + 0.06,   // slight stretch along the movement
      slits
    });
  }

  // Draw one stamp (a closed Catmull-Rom curve converted to cubic Beziers)
  function drawStamp(s, radius) {
    const n = SAMPLES;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.scale(s.stretch, 1 / Math.sqrt(s.stretch));
    const px = new Float32Array(n), py = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = radius * s.shape[i];
      px[i] = Math.cos(a) * rr; py[i] = Math.sin(a) * rr;
    }
    const path = new Path2D();
    path.moveTo(px[0], py[0]);
    for (let i = 0; i < n; i++) {
      const p0 = (i - 1 + n) % n, p1 = i, p2 = (i + 1) % n, p3 = (i + 2) % n;
      path.bezierCurveTo(
        px[p1] + (px[p2] - px[p0]) / 6, py[p1] + (py[p2] - py[p0]) / 6,
        px[p2] - (px[p3] - px[p1]) / 6, py[p2] - (py[p3] - py[p1]) / 6,
        px[p2], py[p2]
      );
    }
    path.closePath();
    for (const sl of s.slits) {   // holes cut with even-odd fill
      path.ellipse(sl.pos * radius, sl.lat * radius, sl.len * radius, Math.max(0.6, sl.wid * radius), sl.rot, 0, Math.PI * 2);
    }
    ctx.fill(path, 'evenodd');
    ctx.restore();
  }

  /* ---------- Sizing (image drawn like object-fit: cover so both layers align) ---------- */
  function resize() {
    const r = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawCover(img) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  /* ---------- Pointer handling (mouse + touch) ---------- */
  function onMove(e) {
    const r = hero.getBoundingClientRect();
    tx = e.clientX - r.left; ty = e.clientY - r.top;
    if (!active) {                    // first move, or re-entry: start a brand-new stroke here
      active = true; sx = tx; sy = ty;
      hasLast = false; hasDir = false; speedNorm = 0;
      slits = makeSlits(Math.random() * 1000);
      if (hint) hint.classList.add('gone');
    }
  }
  function stop() { active = false; hasLast = false; }

  hero.addEventListener('pointermove', onMove);
  hero.addEventListener('pointerdown', onMove);
  hero.addEventListener('pointerleave', stop);
  hero.addEventListener('pointercancel', stop);
  hero.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') stop(); });
  window.addEventListener('blur', stop);
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);

  /* ---------- Frame loop ---------- */
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (active) {                                  // 1. smooth follow + stamps along the path
      const k = 1 - Math.pow(1 - FOLLOW, dt * 60);
      sx += (tx - sx) * k; sy += (ty - sy) * k;
      const baseR = BRUSH_FACTOR * Math.min(W, H);
      const step = Math.max(1, baseR * SPACING);
      if (!hasLast) {
        lastX = sx; lastY = sy; hasLast = true;
        addStamp(sx, sy, dirAngle, baseR, now);
      } else {
        const dx = sx - lastX, dy = sy - lastY, dist = Math.hypot(dx, dy);
        if (dist >= step) {
          const ang = Math.atan2(dy, dx);
          if (!hasDir) { dirAngle = ang; hasDir = true; }
          else {
            let d = ang - dirAngle;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            dirAngle += d * 0.25;                  // gentle rotation, not a snap
          }
          speedNorm = Math.min(1, (dist / Math.max(dt, 0.001)) / 2500);
          const ux = dx / dist, uy = dy / dist;
          let travelled = 0;
          while (dist - travelled >= step) {       // many overlapping stamps = no gaps even on fast moves
            travelled += step;
            addStamp(lastX + ux * travelled, lastY + uy * travelled, dirAngle, baseR, now);
          }
          lastX += ux * travelled; lastY += uy * travelled;
        } else speedNorm *= 0.9;
      }
    }

    const life = LIFETIME * 1000;                  // 2. drop expired stamps
    if (stamps.length && now - stamps[0].born >= life) stamps = stamps.filter((s) => now - s.born < life);

    if (img1) {                                    // 3. rebuild the mask from scratch
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      drawCover(img1);
      if (stamps.length) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        for (const s of stamps) {
          const lifeLeft = Math.max(0, 1 - (now - s.born) / 1000 / LIFETIME);   // shrink, not fade
          const radius = s.r * Math.pow(lifeLeft, 0.85);
          if (radius > 0.5) drawStamp(s, radius);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Load both images, then start ---------- */
  function load(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  Promise.all([load(IMG_TOP), load(IMG_BOTTOM)]).then(([a, b]) => {
    img1 = a; under.src = b.src;
    resize(); lastT = performance.now();
    requestAnimationFrame(frame);
  }).catch(() => { if (errEl) errEl.style.display = 'flex'; });
})();
