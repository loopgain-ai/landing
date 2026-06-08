/* LoopGain landing — minimal vanilla JS.
   - theme toggle (dark by default; light only via explicit user click)
   - copy-to-clipboard for inline pip box + code panels
   - tabbed code panels
   - animated hero contrast chart: one REAL run (seed 114) illustrating rollback.
     LoopGain runs 3 attempts, sees the loop degrade, and rolls back to the best
     it saw (err 1); the max_iter=20 baseline runs all 20 and ships broken (err 11).
*/

(() => {
  // ─────────── theme toggle ───────────
  // Dark is the default for everyone on first visit. We deliberately do NOT
  // honour prefers-color-scheme — the brand reads better on dark, and tools
  // that render with light-mode defaults (Google's mobile inspector, Twitter
  // card preview, etc.) were flipping the page in ways that broke the brand.
  // Light mode is still available — but only as an explicit user choice via
  // the in-page theme toggle. That choice persists via localStorage.
  const root = document.documentElement;
  const stored = localStorage.getItem('lg-theme');
  if (stored === 'light' || stored === 'dark') {
    root.setAttribute('data-theme', stored);
  }
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('lg-theme', next);
    });
  }

  // ─────────── copy-to-clipboard ───────────
  function bindCopy(el) {
    if (!el || el.__bound) return;
    el.__bound = true;
    const text = el.getAttribute('data-copy') || el.querySelector('code')?.textContent || '';
    const run = async () => {
      try { await navigator.clipboard.writeText(text); }
      catch { /* swallow — older browsers */ }
      el.classList.add('copied');
      const hint = el.querySelector('.copy-hint');
      const prev = hint && hint.textContent;
      if (hint) hint.textContent = 'copied';
      setTimeout(() => {
        el.classList.remove('copied');
        if (hint && prev) hint.textContent = prev;
      }, 1400);
    };
    el.addEventListener('click', run);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); }
    });
  }
  document.querySelectorAll('.copy-box').forEach(bindCopy);

  // ─────────── tabs ───────────
  const tabs = document.querySelectorAll('.ct-tab');
  const panels = document.querySelectorAll('.code-panel');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      const name = t.dataset.tab;
      tabs.forEach(x => {
        const on = x.dataset.tab === name;
        x.classList.toggle('is-active', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === name));
    });
  });

  // copy currently-visible code panel
  const codeCopy = document.getElementById('codeCopy');
  if (codeCopy) {
    codeCopy.addEventListener('click', async () => {
      const active = document.querySelector('.code-panel.is-active code');
      if (!active) return;
      const text = active.textContent;
      try { await navigator.clipboard.writeText(text); } catch {}
      codeCopy.classList.add('copied');
      codeCopy.textContent = 'copied';
      setTimeout(() => {
        codeCopy.classList.remove('copied');
        codeCopy.textContent = 'copy';
      }, 1400);
    });
  }

  // ─────────── hero chart: ONE real run, rollback in action ───────────
  // A SINGLE real max_iter=20 benchmark trajectory
  // (`w1-codegen-claude-agent-sdk-claude-haiku-4-5-seed114`). We draw the one
  // trajectory and show where each stop policy lands ON IT — no second rollout,
  // so the quality difference is purely the stop rule, not run-to-run variance.
  // This trial SHOWS THE MECHANISM (rollback) and refutes "why not just cap at 1?":
  //   • The run: error_history = B20_ERR below. Attempt 1 is BROKEN (err 11) — a
  //     cap-at-1 ships that. Attempt 2 is nearly right (err 1). Attempt 3 breaks
  //     again (err 11). The loop keeps oscillating and ships err 11 at attempt 20.
  //   • max_iter=20: runs all 20, ships its LAST attempt (err 11, broken).
  //     real measured cost_usd.B20 = $0.051159.
  //   • LoopGain: runs 3 attempts, sees the loop OSCILLATE (11→1→11), stops, and
  //     ROLLS BACK to the best it saw (err 1 at attempt 2) — an answer the loop had
  //     already thrown away. Cost = the same run's spend through attempt 3 ≈
  //     $0.0077 (3 of 20).
  //   → saved ≈ $0.043 on this trial (~85% / ~7×), AND recovers a working answer.
  //
  // The green line is the run's observed prefix (the SHARED trajectory up to the
  // stop); the dashed segment is the rollback — LoopGain returning to the best,
  // not the last (which is what a fixed cap ships). Same-trajectory claim pinned by
  // loopgain-verify (replay the rule on this trajectory → stop@3, roll back to err 1).
  //
  // Design/honesty: the RIGHT axis (error) is the only quantitative axis.
  const B20_ERR = [11, 1, 11, 11, 1, 11, 11, 1, 11, 11, 1, 0, 11, 11, 0, 10, 11, 11, 1, 11];
  const NB      = B20_ERR.length;        // 20 — the iteration axis spans the run
  const LG_STOP = 3;                     // attempts LoopGain ran before stopping (OSCILLATING)
  const LG_BEST_I   = 2;                  // attempt it rolls back to (1-based)
  const LG_BEST_ERR = 1;                  // the error it keeps (best-so-far)
  const LG_ERR  = B20_ERR.slice(0, LG_STOP);  // the SHARED prefix it observed: [11, 1, 11]
  const B20_COST = 0.051159;             // real measured cost_usd.B20 (20 iters)
  const LG_COST  = B20_COST * LG_STOP / NB;   // same run's spend through the stop (~$0.0077)

  const CHART_W = 600, CHART_H = 360;
  const PADX = 26, PADTOP = 18, PADBOT = 22;
  const EMAX = 11;

  const iterToX = (i) => PADX + ((i - 1) / (NB - 1)) * (CHART_W - PADX * 2);   // i: 1..20
  const errToY  = (e) => {
    const top = PADTOP, bot = CHART_H - PADBOT;
    return bot - (Math.min(e, EMAX) / EMAX) * (bot - top);
  };
  const fmt$ = (v) => '$' + Math.max(0, v).toFixed(4);
  const lerp = (a, b, t) => a + (b - a) * t;

  const capSeg  = document.getElementById('capSeg');
  const lgSeg   = document.getElementById('lgSeg');
  const lgOvershoot = document.getElementById('lgOvershoot'); // desaturated rejected attempt
  const lgArea  = document.getElementById('lgArea');
  const head    = document.getElementById('traceHead');   // gray — max_iter=20 head
  const lgHead  = document.getElementById('lgHead');       // green — LoopGain head
  const lgRing  = document.getElementById('lgStopRing');
  const lgGlow  = document.getElementById('lgStopGlow');
  const lgRollback = document.getElementById('lgRollback'); // dashed snap-back to best
  const grid    = document.getElementById('chartGrid');
  const lgChip  = document.getElementById('lgChip');
  const capChip = document.getElementById('capChip');
  const capIterEl = document.getElementById('capIter');
  const capCostEl = document.getElementById('capCost');
  const capVerdict = document.getElementById('capVerdict');
  const savedPctEl = document.getElementById('savedPct');
  const lgStopIterEl = document.getElementById('lgStopIter');
  const lgCostEl = document.getElementById('lgCost');
  const lgVerdictEl = document.getElementById('lgVerdict');

  if (capSeg && lgSeg && grid) {
    // vertical gridlines, one per iteration
    let gridD = '';
    for (let i = 1; i <= NB; i++) {
      const x = iterToX(i).toFixed(1);
      gridD += `M ${x} ${PADTOP} L ${x} ${CHART_H - PADBOT} `;
    }
    grid.setAttribute('d', gridD);

    // place a chip using svg→% mapping (svg is preserveAspectRatio="none")
    const place = (el, x, y, opt = {}) => {
      if (!el) return;
      el.style.left = (x / CHART_W * 100) + '%';
      el.style.top  = (y / CHART_H * 100) + '%';
      const tx = opt.anchor === 'left'  ? 'calc(-100% - 8px)'
               : opt.anchor === 'right' ? '8px'
               : '-50%';
      el.style.transform = `translate(${tx}, ${opt.below ? '8px' : '-130%'})`;
    };

    // Static LoopGain keep marker + chip at the BEST attempt LoopGain rolls back
    // to (iter LG_BEST_I, err LG_BEST_ERR) — NOT the stop iteration. The rollback
    // is the point: it keeps the best it saw, not the last.
    const SX = iterToX(LG_BEST_I), SY = errToY(LG_BEST_ERR);
    [lgRing, lgGlow].forEach(c => { c.setAttribute('cx', SX); c.setAttribute('cy', SY); });
    place(lgChip, SX, SY, { anchor: 'right' });
    // The rollback connector: a dashed ARC from where LoopGain stopped (iter
    // LG_STOP, its then-current error) back to the best it keeps. Bowed out to
    // the right so it reads as a "return" rather than retracing the solid line.
    const RBX = iterToX(LG_STOP), RBY = errToY(B20_ERR[LG_STOP - 1]);
    const CPX = Math.max(RBX, SX) + 38, CPY = (RBY + SY) / 2;
    if (lgRollback) lgRollback.setAttribute('d',
      `M ${RBX.toFixed(1)} ${RBY.toFixed(1)} Q ${CPX.toFixed(1)} ${CPY.toFixed(1)} ${SX.toFixed(1)} ${SY.toFixed(1)}`);
    // point along the rollback arc at param t (0 = stop point, 1 = best) — the
    // head travels this each cycle to animate "rolling back to the best".
    const bez = (t) => {
      const u = 1 - t;
      return { x: u * u * RBX + 2 * u * t * CPX + t * t * SX,
               y: u * u * RBY + 2 * u * t * CPY + t * t * SY };
    };

    // Build a polyline from integer iter `a` to float tip along the given error
    // array, interpolating the final partial segment. Returns path + tip coords.
    function segTo(arr, a, tip) {
      const n = arr.length;
      const end = Math.floor(tip), f = tip - end;
      let d = `M ${iterToX(a).toFixed(1)} ${errToY(arr[a - 1]).toFixed(1)}`;
      for (let i = a + 1; i <= Math.min(end, n); i++) {
        d += ` L ${iterToX(i).toFixed(1)} ${errToY(arr[i - 1]).toFixed(1)}`;
      }
      if (end < n && f > 0 && tip > a) {
        const e = lerp(arr[end - 1], arr[end], f);
        const x = iterToX(end + f);
        d += ` L ${x.toFixed(1)} ${errToY(e).toFixed(1)}`;
        return { d, x, y: errToY(e), e };
      }
      const c = Math.max(a, Math.min(end, n));
      return { d, x: iterToX(c), y: errToY(arr[c - 1]), e: arr[c - 1] };
    }

    let progress = 1;          // current iteration tip (float, 1..20)
    let rbT = 0;               // rollback-arc animation param (0→1), once stopped
    const speed = 0.0030;      // iters per ms → ~6.3s for the full baseline run
    let last = performance.now();
    let pause = 0;

    function tick(now) {
      const dt = Math.min(48, now - last);
      last = now;
      if (pause > 0) { pause -= dt; if (pause <= 0) { progress = 1; pause = 0; } }
      else { progress += speed * dt; if (progress >= NB) { progress = NB; pause = 1900; } }

      const stopped = progress >= LG_STOP;
      const atEnd   = progress >= NB;

      // LoopGain line, split: BOLD descent (→ best) + DESATURATED overshoot
      // (the loop's rejected next attempt). No area fill — it obscures the shape.
      const lgTip = Math.min(progress, LG_STOP);
      lgSeg.setAttribute('d', segTo(LG_ERR, 1, Math.min(lgTip, LG_BEST_I)).d);
      if (lgOvershoot)
        lgOvershoot.setAttribute('d', lgTip > LG_BEST_I ? segTo(LG_ERR, LG_BEST_I, lgTip).d : '');
      lgArea.setAttribute('d', '');

      // max_iter=20 line: iters 1..progress, gray, never settles
      const b20 = segTo(B20_ERR, 1, progress);
      capSeg.setAttribute('d', b20.d);

      // Rollback: once stopped, animate the head BACK along the dashed arc to the
      // best (rbT 0→1 over ~550ms); the dashed arc shows while it travels, and the
      // keep marker pops once it arrives. Resets each loop cycle.
      rbT = stopped ? Math.min(1, rbT + dt / 550) : 0;
      const arrived = rbT >= 1;
      if (lgRollback) lgRollback.setAttribute('opacity', stopped ? 1 : 0);

      const hPos = stopped ? bez(rbT) : segTo(LG_ERR, 1, lgTip);
      lgHead.setAttribute('cx', hPos.x); lgHead.setAttribute('cy', hPos.y);
      lgHead.setAttribute('opacity', arrived ? 0 : 1);
      lgRing.setAttribute('opacity', arrived ? 1 : 0);
      lgGlow.setAttribute('opacity', arrived ? 1 : 0);
      lgChip.classList.toggle('is-on', arrived);

      // max_iter=20 head (gray) rides its line; its chip trails just below
      head.setAttribute('cx', b20.x); head.setAttribute('cy', b20.y);
      if (progress > 1.15) {
        capChip.style.display = '';
        const anchor = b20.x > CHART_W * 0.6 ? 'left' : b20.x < CHART_W * 0.14 ? 'right' : 'center';
        place(capChip, b20.x, b20.y, { anchor, below: true });
        capChip.textContent = atEnd ? `✗ max_iter=20 ships err ${Math.round(B20_ERR[NB - 1])}` : `err ${Math.round(b20.e)}`;
        capChip.classList.toggle('is-broken', atEnd);
      } else {
        capChip.style.display = 'none';
      }

      // max_iter=20 foot: iter count + cost easing to the real measured total
      const capIterNow = Math.min(NB, Math.max(1, Math.ceil(progress)));
      const capCostNow = B20_COST * progress / NB;   // uniform per-iter cost
      capIterEl.textContent = 'iter ' + capIterNow;
      capCostEl.textContent = fmt$(capCostNow);
      capVerdict.textContent = atEnd ? '✗ broken' : 'running…';
      capVerdict.classList.toggle('is-on', atEnd);

      // LoopGain foot: ran LG_STOP attempts, then rolled back to its best.
      const lgIterNow = Math.min(LG_STOP, Math.max(1, Math.ceil(lgTip)));
      const lgCostNow = B20_COST * lgTip / NB;   // same run, same per-iter cost as the cap
      lgStopIterEl.textContent = 'iter ' + lgIterNow;
      lgCostEl.textContent = fmt$(lgCostNow);
      // verdict flips to the rollback result once LoopGain has stopped.
      lgVerdictEl.textContent = stopped ? '✓ rolls back' : 'running…';
      lgVerdictEl.classList.toggle('is-on', stopped);

      // headline savings — % less spend, once LoopGain has stopped and the cap
      // has out-spent it. B20 is the real measured cost_usd; LG is the same run's
      // spend through the stop (LG_STOP of 20 iters). Endpoint: 1 − 3/20 = 85%.
      savedPctEl.textContent = (stopped && capCostNow > LG_COST)
        ? Math.round((1 - LG_COST / capCostNow) * 100) + '%' : '—';

      requestAnimationFrame(tick);
    }
    requestAnimationFrame((t) => { last = t; tick(t); });
  }
})();

/* ─────────── waitlist + newsletter capture ───────────
   Posts to the first-party capture Worker at loopgain.ai/api/* (same-origin).
   The paid-tier CTAs keep a mailto: fallback in the HTML; this upgrades them
   to an inline dialog. The footer form subscribes to the blog newsletter. */
(() => {
  const API = '/api/subscribe';
  const dialog = document.getElementById('waitlistDialog');
  const form = document.getElementById('waitlistForm');
  const titleEl = document.getElementById('wlTitle');
  const subEl = document.getElementById('wlSub');
  const statusEl = document.getElementById('wlStatus');
  const emailEl = document.getElementById('wlEmail');
  const submitBtn = form && form.querySelector('.wl-submit');
  let currentList = 'team';

  const COPY = {
    team: { title: 'Join the Team waitlist', sub: "Paid plans launch soon. Leave your email and we'll tell you the moment Team is live.", cta: 'Join the waitlist' },
    pro: { title: 'Join the Pro waitlist', sub: "Paid plans launch soon. Leave your email and we'll tell you the moment Pro is live.", cta: 'Join the waitlist' },
    enterprise: { title: 'Talk to us about Enterprise', sub: "SLA, data residency, dedicated infrastructure. Leave your email and we'll set up a conversation.", cta: 'Request a conversation' },
    pilot: { title: "Run LoopGain on your stack", sub: "Put LoopGain into your own agent loops and we'll help you wire it in — adapter setup, thresholds, and reading the dashboard on your real workloads. Leave your email and we'll get you going.", cta: 'Get started' },
  };

  async function submitCapture(payload, node, btn, btnLabel) {
    node.className = 'wl-status';
    node.textContent = 'Sending…';
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        node.className = 'wl-status is-ok';
        node.textContent = data.message || "You're on the list.";
        if (btn) btn.textContent = 'Done ✓';
        return true;
      }
      node.className = 'wl-status is-err';
      node.textContent = (data && data.error) || 'Something went wrong — try again, or email hello@loopgain.ai.';
    } catch {
      node.className = 'wl-status is-err';
      node.textContent = 'Network error — try again, or email hello@loopgain.ai.';
    }
    if (btn) { btn.disabled = false; if (btnLabel) btn.textContent = btnLabel; }
    return false;
  }

  if (dialog && form && typeof dialog.showModal === 'function') {
    const open = (list) => {
      currentList = list;
      const c = COPY[list] || COPY.team;
      if (titleEl) titleEl.textContent = c.title;
      if (subEl) subEl.textContent = c.sub;
      if (submitBtn) { submitBtn.textContent = c.cta; submitBtn.disabled = false; }
      if (statusEl) { statusEl.textContent = ''; statusEl.className = 'wl-status'; }
      if (emailEl) emailEl.value = '';
      dialog.showModal();
      setTimeout(() => emailEl && emailEl.focus(), 50);
    };

    document.querySelectorAll('[data-capture]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();             // suppress the mailto fallback
        open(el.getAttribute('data-capture'));
      });
    });

    const closeBtn = document.getElementById('wlClose');
    if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      if (fd.get('company_website')) { dialog.close(); return; }  // honeypot tripped
      const email = (fd.get('email') || '').toString().trim();
      if (!email) return;
      await submitCapture(
        { email, list: currentList, source: 'landing:' + currentList, consent: true, company_website: '' },
        statusEl, submitBtn, (COPY[currentList] || COPY.team).cta,
      );
    });
  }

  // Footer newsletter (blog list, double-opt-in handled server-side).
  const newsForm = document.getElementById('newsletterForm');
  const newsStatus = document.getElementById('newsStatus');
  if (newsForm && newsStatus) {
    newsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(newsForm);
      if (fd.get('company_website')) return;  // honeypot
      const email = (fd.get('email') || '').toString().trim();
      if (!email) return;
      const btn = newsForm.querySelector('button[type=submit]');
      await submitCapture(
        { email, list: 'blog', source: 'landing:footer', consent: true, company_website: '' },
        newsStatus, btn, 'Subscribe',
      );
    });
  }
})();
