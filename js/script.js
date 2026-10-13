/* =========================================================
   Raghd Anaam | Portfolio  -  script.js  (shared by every page)
   Each feature checks that its elements exist, so one file serves all pages.
   ========================================================= */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Navbar: scroll style + mobile menu ---------- */
  const nav = $('.nav');
  const toggle = $('.nav-toggle');
  const menu = $('#nav-menu');

  function onScroll() { nav && nav.classList.toggle('scrolled', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('open', open);
  }
  if (toggle && menu) {
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.nav')) setMenu(false); });
  }

  /* ---------- Page transitions (fade out before following an internal link) ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || reduceMotion) return;
    const href = a.getAttribute('href') || '';
    const internal = a.origin === location.origin && /\.html$|\/$/.test(a.pathname) && !href.startsWith('#');
    if (!internal || a.target === '_blank' || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (a.pathname === location.pathname) return;
    e.preventDefault();
    document.body.classList.add('leaving');
    setTimeout(() => { location.href = a.href; }, 240);
  });
  window.addEventListener('pageshow', () => document.body.classList.remove('leaving'));

  /* ---------- Starfield background ---------- */
  const starCanvas = $('#stars');
  if (starCanvas) {
    const ctx = starCanvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, stars = [], shooting = null;
    let mx = 0, my = 0, px = 0, py = 0, nextShot = performance.now() + 3500;
    const tints = ['255,255,255', '255,255,255', '186,230,253', '249,168,212', '196,181,253'];

    function initStars() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      starCanvas.width = w * dpr; starCanvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(220, Math.round((w * h) / 8500));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h, z: 0.2 + Math.random() * 0.8,
        r: Math.random() * 1.3 + 0.3, tw: Math.random() * Math.PI * 2,
        tint: tints[(Math.random() * tints.length) | 0]
      }));
    }

    function draw(now) {
      ctx.clearRect(0, 0, w, h);
      px += (mx - px) * 0.05; py += (my - py) * 0.05;       // eased mouse parallax
      for (const s of stars) {
        const tw = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(now * 0.0015 + s.tw);
        const x = ((s.x + px * 28 * s.z) % w + w) % w;
        const y = ((s.y + py * 28 * s.z) % h + h) % h;
        ctx.fillStyle = `rgba(${s.tint},${(0.25 + 0.65 * s.z) * tw})`;
        ctx.beginPath(); ctx.arc(x, y, s.r * s.z + 0.2, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduceMotion) {
        if (!shooting && now > nextShot) {                   // occasional shooting star
          shooting = { x: Math.random() * w * 0.8 + w * 0.2, y: Math.random() * h * 0.35, vx: -9, vy: 4.5, life: 0 };
          nextShot = now + 5000 + Math.random() * 5000;
        }
        if (shooting) {
          const s = shooting; s.x += s.vx; s.y += s.vy; s.life += 1;
          const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
          g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(56,189,248,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); ctx.stroke();
          if (s.life > 70 || s.x < -50 || s.y > h + 50) shooting = null;
        }
        if (!document.hidden) requestAnimationFrame(draw);
        else document.addEventListener('visibilitychange', () => requestAnimationFrame(draw), { once: true });
      }
    }

    window.addEventListener('pointermove', (e) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
    window.addEventListener('resize', () => { initStars(); if (reduceMotion) draw(0); });
    initStars();
    requestAnimationFrame(draw);
  }

  /* ---------- Scroll reveal ---------- */
  // After the reveal finishes, drop the class so hover transitions are not slowed by it
  function settle(el) { setTimeout(() => el.classList.remove('reveal'), 1200 + (parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0) * 1000); }
  const revealEls = $$('.reveal');
  if (revealEls.length) {
    if ('IntersectionObserver' in window && !reduceMotion) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); settle(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add('in'));
    }
  }

  /* ---------- Typing animation ---------- */
  const typedEl = $('#typed');
  if (typedEl) {
    const roles = (typedEl.dataset.roles || '').split('|').filter(Boolean);
    if (reduceMotion || !roles.length) {
      typedEl.textContent = roles[0] || '';
    } else {
      let r = 0, c = 0, deleting = false;
      (function tick() {
        const word = roles[r];
        c += deleting ? -1 : 1;
        typedEl.textContent = word.slice(0, c);
        let delay = deleting ? 38 : 80;
        if (!deleting && c === word.length) { deleting = true; delay = 1500; }
        else if (deleting && c === 0) { deleting = false; r = (r + 1) % roles.length; delay = 350; }
        setTimeout(tick, delay);
      })();
    }
  }

  /* ---------- Count-up numbers ---------- */
  $$('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const show = (v) => { el.textContent = v.toFixed(dec) + suffix; };
    if (reduceMotion || !('IntersectionObserver' in window)) { show(target); return; }
    show(0);
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1300;
      (function step(now) {
        const p = Math.min(1, (now - t0) / dur);
        show(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: 0.6 });
    io.observe(el);
  });

  /* ---------- Animated skill bars ---------- */
  const bars = $$('.bar i[data-w]');
  if (bars.length) {
    const fill = (el) => { el.style.width = el.dataset.w + '%'; };
    if ('IntersectionObserver' in window && !reduceMotion) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { fill(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.4 });
      bars.forEach((b) => io.observe(b));
    } else bars.forEach(fill);
  }

  /* ---------- Project filter ---------- */
  const filterBtns = $$('.filter-btn');
  const cards = $$('.project-grid .project-card');
  if (filterBtns.length && cards.length) {
    const status = $('#filter-status');
    const empty = $('.no-results');
    filterBtns.forEach((btn) => btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      let shown = 0;
      cards.forEach((card) => {
        const match = f === 'all' || card.dataset.cat.split(' ').includes(f);
        card.classList.toggle('hide', !match);
        card.classList.remove('pop');
        if (match) { shown++; card.classList.remove('reveal'); void card.offsetWidth; card.classList.add('pop'); }
      });
      if (empty) empty.classList.toggle('show', shown === 0);
      if (status) status.textContent = `Showing ${shown} project${shown === 1 ? '' : 's'}`;
    }));
  }

  /* ---------- Project detail modal ---------- */
  const modal = $('#projectModal');
  if (modal && cards.length) {
    let lastTrigger = null;
    const set = (sel, html) => { $(sel, modal).innerHTML = html; };

    function openModal(card) {
      lastTrigger = card.querySelector('.js-details') || card;
      const img = card.querySelector('.card-img img');
      const mi = $('[data-m-img]', modal);
      mi.src = img.currentSrc || img.src; mi.alt = img.alt;
      set('[data-m-title]', card.querySelector('h3').innerHTML);
      set('[data-m-tags]', card.querySelector('.card-tags').innerHTML);
      set('[data-m-details]', card.querySelector('.card-details').innerHTML);
      set('[data-m-stack]', card.querySelector('.chip-list').innerHTML);
      set('[data-m-links]', card.querySelector('.card-links').innerHTML);
      modal.showModal();
      document.documentElement.style.overflow = 'hidden';
    }

    cards.forEach((card) => card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;                 // let real links work
      openModal(card);
    }));
    $('.modal-close', modal).addEventListener('click', () => modal.close());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });   // click on backdrop
    modal.addEventListener('close', () => {
      document.documentElement.style.overflow = '';
      if (lastTrigger) lastTrigger.focus();
    });
  }

  /* ---------- Contact form: validation + Formspree ---------- */
  const form = $('#contact-form');
  if (form) {
    const status = $('#form-status');
    const rules = {
      name:    (v) => v.trim().length >= 2 ? '' : 'Please enter your name (at least 2 characters).',
      email:   (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address.',
      message: (v) => v.trim().length >= 10 ? '' : 'Your message should be at least 10 characters.'
    };
    function check(field) {
      const input = form.elements[field];
      const msg = rules[field](input.value);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      $('#err-' + field).textContent = msg;
      return !msg;
    }
    Object.keys(rules).forEach((f) => {
      form.elements[f].addEventListener('blur', () => check(f));
      form.elements[f].addEventListener('input', () => { if (form.elements[f].getAttribute('aria-invalid') === 'true') check(f); });
    });

    function say(type, text) { status.className = 'form-status ' + type; status.textContent = text; }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const results = Object.keys(rules).map(check);
      if (results.includes(false)) {
        const first = Object.keys(rules).find((f) => form.elements[f].getAttribute('aria-invalid') === 'true');
        form.elements[first].focus();
        say('err', 'Please fix the highlighted fields and try again.');
        return;
      }
      if (form.elements._gotcha && form.elements._gotcha.value) return;   // honeypot: bots only
      const action = form.getAttribute('action') || '';
      const btn = form.querySelector('button[type="submit"]');

      // Demo mode until a real Formspree ID is set in contact.html
      if (action.includes('YOUR_FORM_ID')) {
        say('info', 'Demo mode: your message passed validation but was not sent. Add your Formspree form ID in contact.html to start receiving messages.');
        form.reset();
        return;
      }
      btn.disabled = true; btn.textContent = 'Sending...';
      try {
        const res = await fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (res.ok) { say('ok', 'Thank you! Your message has been sent. I will get back to you soon.'); form.reset(); }
        else say('err', 'Something went wrong while sending. Please try again or email me directly.');
      } catch (err) {
        say('err', 'Network error. Please check your connection or email me directly.');
      } finally {
        btn.disabled = false; btn.textContent = 'Send message';
      }
    });
  }

  /* ---------- Footer year ---------- */
  const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();
})();
