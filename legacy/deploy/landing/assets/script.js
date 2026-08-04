/* ============================================================
   BYG SMART — marketing site shared script
   Plain vanilla JS. Every init function is defensive (checks the
   element exists first) so this one file can be included on
   every page — it just no-ops for sections that aren't present.
   ============================================================ */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var byId = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------------- Nav: scroll solidify (home hero only) ---------------- */
  function initNavScroll() {
    var nav = byId('bygNav');
    var hero = byId('top');
    if (!nav) return;
    if (!hero) { nav.classList.add('byg-solid'); return; } // subpages: always solid
    var onScroll = function () {
      var y = window.scrollY || window.pageYOffset;
      if (y > 60) nav.classList.add('byg-solid');
      else nav.classList.remove('byg-solid');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- Mobile menu ---------------- */
  function initMobileMenu() {
    var toggle = byId('bygNavToggle');
    var menu = byId('bygMobileMenu');
    var closeBtn = menu ? menu.querySelector('.byg-mm-close') : null;
    if (!toggle || !menu) return;
    var open = function () { menu.classList.add('open'); document.body.style.overflow = 'hidden'; };
    var close = function () { menu.classList.remove('open'); document.body.style.overflow = ''; };
    toggle.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
  }

  /* ---------------- Scroll reveal ---------------- */
  function initReveals() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!els.length) return;
    els.forEach(function (el) {
      if (reduced) return;
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity .7s cubic-bezier(.2,0,0,1), transform .7s cubic-bezier(.2,0,0,1)';
      var d = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
      el.style.transitionDelay = (d / 1000) + 's';
    });
    if (reduced) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'none'; io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- Counters ---------------- */
  function initCounters() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    if (!els.length) return;
    var fmt = function (n) { return n.toLocaleString('da-DK'); };
    var run = function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      var suffix = el.getAttribute('data-suffix') || '';
      if (reduced) { el.textContent = fmt(target) + suffix; return; }
      var dur = 1500, start = performance.now();
      var step = function (now) {
        var t = clamp((now - start) / dur, 0, 1);
        var e = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(Math.round(target * e)) + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- Gantt demo ---------------- */
  function initGantt() {
    var gantt = byId('bygGantt');
    var bars = Array.prototype.slice.call(document.querySelectorAll('.bygBar'));
    if (!gantt || !bars.length) return;
    if (reduced) { bars.forEach(function (b) { b.style.width = b.getAttribute('data-gantt-w') + '%'; }); return; }
    var timers = [];
    var clearAll = function () { timers.forEach(clearTimeout); timers = []; };
    var play = function () {
      clearAll();
      bars.forEach(function (b) { b.style.width = '0%'; });
      bars.forEach(function (b, idx) { timers.push(setTimeout(function () { b.style.width = b.getAttribute('data-gantt-w') + '%'; }, 300 + idx * 280)); });
      timers.push(setTimeout(play, 300 + bars.length * 280 + 2800));
    };
    var playing = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { if (!playing) { playing = true; play(); } }
        else { playing = false; clearAll(); }
      });
    }, { threshold: 0.35 });
    io.observe(gantt);
  }

  /* ---------------- Steps demo ---------------- */
  function initSteps() {
    var fill = byId('bygStepFill');
    var wrap = byId('bygSteps');
    var steps = Array.prototype.slice.call(document.querySelectorAll('.bygStep'));
    if (!fill || !wrap || !steps.length) return;
    var setActive = function (el, on) {
      var c = el.getAttribute('data-accent');
      if (on) { el.style.background = c; el.style.color = '#fff'; el.style.transform = 'scale(1.09)'; el.style.boxShadow = '0 12px 26px -8px ' + c + '80'; }
      else { el.style.background = '#fff'; el.style.color = el.getAttribute('data-fg') || c; el.style.transform = 'none'; el.style.boxShadow = 'none'; }
    };
    if (reduced) { steps.forEach(function (s) { setActive(s, true); }); fill.style.width = '100%'; return; }
    var timers = [];
    var clearAll = function () { timers.forEach(clearTimeout); timers = []; };
    var play = function () {
      clearAll();
      steps.forEach(function (s) { setActive(s, false); }); fill.style.width = '0%';
      timers.push(setTimeout(function () { setActive(steps[0], true); }, 250));
      timers.push(setTimeout(function () { fill.style.width = '50%'; }, 800));
      timers.push(setTimeout(function () { setActive(steps[1], true); }, 1350));
      timers.push(setTimeout(function () { fill.style.width = '100%'; }, 1900));
      timers.push(setTimeout(function () { setActive(steps[2], true); }, 2450));
      timers.push(setTimeout(play, 5600));
    };
    var playing = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { if (!playing) { playing = true; play(); } }
        else { playing = false; clearAll(); }
      });
    }, { threshold: 0.4 });
    io.observe(wrap);
  }

  /* ---------------- Calculator demo ---------------- */
  function initCalc() {
    var card = byId('bygCalc');
    var iso = byId('bygCalcIso'), lam = byId('bygCalcLambda'), res = byId('bygCalcResult'), badge = byId('bygCalcBadge');
    var row1 = byId('bygCalcRow1'), row2 = byId('bygCalcRow2');
    if (!card || !iso || !lam || !res || !badge) return;
    var daNum = function (v, d) { return v.toFixed(d).replace('.', ','); };
    var finalize = function () { iso.textContent = '250 mm'; lam.textContent = '0,034 W/mK'; res.textContent = '0,14'; badge.style.opacity = '1'; badge.style.transform = 'none'; };
    if (reduced) { finalize(); return; }
    badge.style.transition = 'opacity .5s cubic-bezier(.34,1.3,.64,1), transform .5s cubic-bezier(.34,1.3,.64,1)';
    [row1, row2].forEach(function (r) { if (r) r.style.transition = 'border-color .25s, box-shadow .25s, background .25s'; });
    var focus = function (el, on) { if (!el) return; el.style.borderColor = on ? '#1E5FFF' : '#F2F4F7'; el.style.boxShadow = on ? '0 0 0 3px rgba(30,95,255,.12)' : 'none'; el.style.background = on ? '#fff' : '#F9FAFB'; };
    var timers = [], raf = null;
    var clearAll = function () { timers.forEach(clearTimeout); timers = []; if (raf) cancelAnimationFrame(raf); raf = null; };
    var count = function (el, to, dur, d, suffix) {
      var start = performance.now();
      var step = function (now) {
        var t = clamp((now - start) / dur, 0, 1);
        var e = 1 - Math.pow(1 - t, 3);
        el.textContent = daNum(to * e, d) + suffix;
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    var reset = function () { iso.textContent = '–'; lam.textContent = '–'; res.textContent = '–'; badge.style.opacity = '0'; badge.style.transform = 'translateY(8px)'; focus(row1, false); focus(row2, false); };
    var play = function () {
      clearAll(); reset();
      timers.push(setTimeout(function () { focus(row1, true); count(iso, 250, 700, 0, ' mm'); }, 500));
      timers.push(setTimeout(function () { focus(row1, false); }, 1350));
      timers.push(setTimeout(function () { focus(row2, true); count(lam, 0.034, 700, 3, ' W/mK'); }, 1600));
      timers.push(setTimeout(function () { focus(row2, false); }, 2450));
      timers.push(setTimeout(function () { res.textContent = 'Beregner…'; }, 2700));
      timers.push(setTimeout(function () { count(res, 0.14, 700, 2, ''); }, 3300));
      timers.push(setTimeout(function () { badge.style.opacity = '1'; badge.style.transform = 'none'; }, 4200));
      timers.push(setTimeout(play, 8200));
    };
    var playing = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { if (!playing) { playing = true; play(); } }
        else { playing = false; clearAll(); }
      });
    }, { threshold: 0.4 });
    io.observe(card);
  }

  /* ---------------- Pricing monthly/yearly toggle ---------------- */
  /* NOTE: yearly figures apply the same -20% the original mockup used.
     Confirm against the live Stripe yearly price IDs before launch. */
  function initPricing() {
    var mBtn = byId('bygBillMonth');
    var yBtn = byId('bygBillYear');
    var pill = byId('bygBillPill');
    if (!mBtn || !yBtn || !pill) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-price-monthly]'));
    if (!cards.length) return;
    var movePill = function (btn) {
      pill.style.width = btn.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + (btn.offsetLeft - 5) + 'px)';
    };
    var setMode = function (mode) {
      cards.forEach(function (c) {
        var priceEl = c.querySelector('[data-price-value]');
        var noteEl = c.querySelector('[data-price-note]');
        var monthly = c.getAttribute('data-price-monthly');
        var yearly = c.getAttribute('data-price-yearly');
        var noteM = c.getAttribute('data-note-monthly');
        var noteY = c.getAttribute('data-note-yearly');
        if (!priceEl) return;
        if (mode === 'aar') { priceEl.textContent = yearly; if (noteEl) noteEl.textContent = noteY; }
        else { priceEl.textContent = monthly; if (noteEl) noteEl.textContent = noteM; }
      });
      if (mode === 'aar') { yBtn.style.color = '#101828'; mBtn.style.color = '#475467'; movePill(yBtn); }
      else { mBtn.style.color = '#101828'; yBtn.style.color = '#475467'; movePill(mBtn); }
    };
    mBtn.addEventListener('click', function () { setMode('maaned'); });
    yBtn.addEventListener('click', function () { setMode('aar'); });
    requestAnimationFrame(function () { setMode('aar'); });
    window.addEventListener('resize', function () {
      var active = (yBtn.style.color === 'rgb(16, 24, 40)' || yBtn.style.color === '#101828') ? yBtn : mBtn;
      movePill(active);
    });
  }

  /* ---------------- Trust / quote carousel ---------------- */
  function initCarousel() {
    var quotes = Array.prototype.slice.call(document.querySelectorAll('.bygQuote'));
    var dots = Array.prototype.slice.call(document.querySelectorAll('[data-dot]'));
    if (!quotes.length) return;
    var i = 0, hovered = false, timer = null;
    var show = function (n) {
      i = (n + quotes.length) % quotes.length;
      quotes.forEach(function (q, qi) {
        var on = qi === i;
        q.style.opacity = on ? '1' : '0';
        q.style.pointerEvents = on ? 'auto' : 'none';
      });
      dots.forEach(function (d, di) {
        var on = di === i;
        d.style.background = on ? '#00529B' : '#D0D5DD';
        d.style.width = on ? '24px' : '9px';
        d.style.borderRadius = on ? '999px' : '50%';
      });
    };
    dots.forEach(function (d, di) { d.addEventListener('click', function () { show(di); restart(); }); });
    var card = byId('bygQuoteCard');
    if (card) {
      card.addEventListener('mouseenter', function () { hovered = true; });
      card.addEventListener('mouseleave', function () { hovered = false; });
    }
    function restart() {
      if (timer) clearInterval(timer);
      if (reduced) return;
      timer = setInterval(function () { if (!hovered) show(i + 1); }, 5200);
    }
    show(0); restart();
  }

  /* ---------------- AI chat demo ---------------- */
  function initAiChat() {
    var body = byId('bygChatBody');
    if (!body) return;
    var pairs = [
      { q: 'Hvilken U-værdi kræver BR18 for en ny ydervæg?', a: 'Kravet er <b>U ≤ 0,18 W/m²K</b>. Med 250 mm mineraluld (λ 0,034) lander du på ca. 0,14 – godkendt.' },
      { q: 'Hvor stor skal en redningsåbning i et soveværelse være?', a: 'Summen af fri højde og bredde skal være mindst <b>1,5 m</b>, og bredden må ikke være under 0,5 m (BR18 §98).' },
      { q: 'Hvad er frostfri dybde for et stribefundament?', a: 'Regn med <b>0,9 m</b> i det meste af Danmark. Ved uopvarmet gulv bør du gå til 1,0 m.' },
      { q: 'Hvor meget bærer en 45×195 mm C24-bjælke over 3,6 m?', a: 'Ved c/c 600 mm og normal nyttelast holder den nedbøjningskravet <b>L/400</b>. Vil du se beregningen?' },
      { q: 'Hvilket fald skal et 110 mm afløbsrør have?', a: 'Minimum <b>20 ‰</b> (2 cm pr. meter), så du undgår aflejringer i røret.' }
    ];
    if (reduced) return;
    var uCss = 'align-self:flex-end; max-width:72%; background:#1E5FFF; color:#fff; padding:11px 15px; border-radius:16px 16px 4px 16px; font-size:14px; line-height:1.45; opacity:0; transform:translateY(8px); transition:opacity .35s cubic-bezier(.2,0,0,1), transform .35s cubic-bezier(.2,0,0,1);';
    var bCss = 'align-self:flex-start; max-width:78%; background:#fff; color:#101828; padding:11px 15px; border-radius:16px 16px 16px 4px; font-size:14px; line-height:1.45; border:1px solid #F2F4F7; opacity:0; transform:translateY(8px); transition:opacity .35s cubic-bezier(.2,0,0,1), transform .35s cubic-bezier(.2,0,0,1);';
    var mk = function (css, html, txt) { var d = document.createElement('div'); d.style.cssText = css; if (txt !== undefined) d.textContent = txt; else d.innerHTML = html; return d; };
    var mkTyping = function () { var d = document.createElement('div'); d.style.cssText = 'align-self:flex-start; display:flex; gap:5px; align-items:center; padding:12px 15px; background:#fff; border:1px solid #F2F4F7; border-radius:16px 16px 16px 4px;'; d.innerHTML = '<span class="byg-td"></span><span class="byg-td" style="animation-delay:.18s"></span><span class="byg-td" style="animation-delay:.36s"></span>'; return d; };
    var MAX = 6, chatAlive = true, chatT = null;
    var append = function (node) {
      body.appendChild(node);
      while (body.children.length > MAX) body.removeChild(body.firstChild);
      requestAnimationFrame(function () { node.style.opacity = '1'; node.style.transform = 'none'; });
      return node;
    };
    var wait = function (ms) { return new Promise(function (r) { chatT = setTimeout(r, ms); }); };
    body.innerHTML = '';
    var i = 0;
    (async function run() {
      while (chatAlive) {
        var p = pairs[i % pairs.length];
        append(mk(uCss, null, p.q));
        await wait(750);
        if (!chatAlive) return;
        var typing = append(mkTyping());
        await wait(1150);
        if (!chatAlive) return;
        typing.remove();
        append(mk(bCss, p.a));
        await wait(3400);
        i++;
      }
    })();
  }

  /* ---------------- Simple catalog filter (br18-katalog.html) ---------------- */
  function initCatalogFilter() {
    var input = byId('bygCatalogSearch');
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-filter-item]'));
    var countEl = byId('bygCatalogCount');
    if (!input || !items.length) return;
    var apply = function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (el) {
        var hay = (el.getAttribute('data-filter-item') || '').toLowerCase();
        var match = !q || hay.indexOf(q) !== -1;
        el.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      if (countEl) countEl.textContent = shown;
    };
    input.addEventListener('input', apply);
    apply();
  }

  /* ---------------- Contact form (kontakt.html) ---------------- */
  function initContactForm() {
    var form = byId('bygContactForm');
    if (!form) return;
    var statusEl = byId('bygContactStatus');
    var btn = form.querySelector('button[type="submit"]');
    var API_URL = 'https://app.bygsmart.com/api/contact';

    var showStatus = function (kind, msg) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = 'byg-form-status ' + (kind === 'ok' ? 'byg-form-status-ok' : 'byg-form-status-err');
    };

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (statusEl) { statusEl.className = 'byg-form-status'; statusEl.textContent = ''; }

      var data = new FormData(form);
      var payload = {
        name: (data.get('name') || '').toString().trim(),
        email: (data.get('email') || '').toString().trim(),
        company: (data.get('company') || '').toString().trim(),
        subject: (data.get('subject') || '').toString().trim(),
        message: (data.get('message') || '').toString().trim(),
        website: (data.get('website') || '').toString() // honeypot
      };

      if (!payload.name || !payload.email || !payload.subject || payload.message.length < 10) {
        showStatus('err', 'Udfyld venligst navn, e-mail, emne og en besked på mindst 10 tegn.');
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = 'Sender…'; }

      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            if (!res.ok || json.error) {
              throw new Error(json.error || 'Noget gik galt. Prøv igen.');
            }
            return json;
          });
        })
        .then(function () {
          showStatus('ok', 'Tak! Din besked er sendt — vi svarer normalt inden for én arbejdsdag.');
          form.reset();
        })
        .catch(function (err) {
          showStatus('err', err.message || 'Beskeden kunne ikke sendes. Skriv i stedet direkte til support@bygsmart.com.');
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'Send besked'; }
        });
    });
  }

  /* ---------------- Sticky TOC scrollspy (om-bygsmart.html) ---------------- */
  function initTocScrollspy() {
    var toc = byId('bygToc');
    if (!toc) return;
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var sections = links
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);
    if (!sections.length) return;

    var setActive = function (id) {
      links.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + id);
      });
    };

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );
    sections.forEach(function (s) { io.observe(s); });
    setActive(sections[0].id);
  }

  /* ---------------- Smooth in-page anchors ---------------- */
  function initSmoothLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        var id = a.getAttribute('href').slice(1);
        if (!id) return;
        var el = document.getElementById(id);
        if (!el) return;
        ev.preventDefault();
        var y = el.getBoundingClientRect().top + window.pageYOffset - 70;
        window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------------- Mobile sticky CTA (home only) ---------------- */
  function initMobileCta() {
    var cta = byId('bygMobileCta');
    var top = byId('top');
    if (!cta || !top) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { cta.style.transform = e.isIntersecting ? 'translateY(120%)' : 'translateY(0)'; });
    }, { threshold: 0 });
    io.observe(top);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNavScroll();
    initMobileMenu();
    initReveals();
    initCounters();
    initGantt();
    initSteps();
    initCalc();
    initPricing();
    initCarousel();
    initAiChat();
    initCatalogFilter();
    initContactForm();
    initTocScrollspy();
    initSmoothLinks();
    initMobileCta();
  });
})();
