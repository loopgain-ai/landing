/* LoopGain landing — minimal vanilla JS.
   - theme toggle (dark by default; light only via explicit user click)
   - copy-to-clipboard for inline pip box + code panels
   - tabbed code panels
   - animated hero contrast chart: one REAL run (seed 34). LoopGain stops at
     iter 2 (converged); the max_iter=20 baseline runs all 20 and ends broken.
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

  // ─────────── hero chart: one real run, two stop policies (seed 114) ───────────
  // REAL trajectory, bench trial `w1-codegen-langgraph-claude-haiku-4-5-seed114`:
  //   error_history = [10,1,0,11,11,10,2,11,10,2,0,11,10,1,11,11,11,10,11,9]
  //   The loop reaches the answer (err 0) at iter 3, then keeps revising and
  //   breaks it back to err 9 by iter 20.
  // ONE path, two policies — so the difference is the stop rule, not sampling luck:
  //   • LoopGain stops at iter 3 (TARGET_MET, verified by the real classifier),
  //     keeps the err-0 output. cost ≈ $0.0081 (3 iters).
  //   • max_iter=20 runs all 20 and keeps the last (err 9). cost = $0.053865.
  //   → ~85% less spend AND a better answer this run.
  //
  // Design/honesty: the RIGHT axis (error) is the only quantitative axis. Iters
  // 1–3 are green (LoopGain is watching and the loop is converging); iters 3–20
  // are gray — what the fixed cap keeps doing with no stop signal once the answer
  // was already found.
  const ERR = [10, 1, 0, 11, 11, 10, 2, 11, 10, 2, 0, 11, 10, 1, 11, 11, 11, 10, 11, 9];
  const NB = ERR.length;                 // 20
  const STOP = 3;                        // LoopGain stops here (TARGET_MET, err 0)
  const CAP_COST = 0.053865;             // real B20 cost for this trial
  const PER = CAP_COST / NB;             // per-iteration $ (same path → same per-iter)
  const LG_COST = PER * STOP;            // ≈ $0.0081

  const CHART_W = 600, CHART_H = 360;
  const PADX = 26, PADTOP = 18, PADBOT = 22;
  const EMAX = 11;

  const iterToX = (i) => PADX + ((i - 1) / (NB - 1)) * (CHART_W - PADX * 2);   // i: 1..20
  const errToY  = (e) => {
    const top = PADTOP, bot = CHART_H - PADBOT;
    return bot - (Math.min(e, EMAX) / EMAX) * (bot - top);
  };
  const fmt$ = (v) => '$' + v.toFixed(4);
  const lerp = (a, b, t) => a + (b - a) * t;

  const capSeg  = document.getElementById('capSeg');
  const lgSeg   = document.getElementById('lgSeg');
  const lgArea  = document.getElementById('lgArea');
  const head    = document.getElementById('traceHead');
  const lgRing  = document.getElementById('lgStopRing');
  const lgGlow  = document.getElementById('lgStopGlow');
  const grid    = document.getElementById('chartGrid');
  const lgChip  = document.getElementById('lgChip');
  const capChip = document.getElementById('capChip');
  const capIterEl = document.getElementById('capIter');
  const capCostEl = document.getElementById('capCost');
  const capVerdict = document.getElementById('capVerdict');
  const savedPctEl = document.getElementById('savedPct');

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

    // static LoopGain stop/keep marker + chip at (iter 3, err 0). The dot sits
    // at the bottom of the plot (err 0), so the chip goes top-right of it —
    // never below, where it would spill past the chart edge.
    const SX = iterToX(STOP), SY = errToY(0);
    [lgRing, lgGlow].forEach(c => { c.setAttribute('cx', SX); c.setAttribute('cy', SY); });
    place(lgChip, SX, SY, { anchor: 'right' });

    // Build a polyline from integer iter `a` to float tip, interpolating the
    // final partial segment. Returns the path and the tip coords/error.
    function segTo(a, tip) {
      const end = Math.floor(tip), f = tip - end;
      let d = `M ${iterToX(a).toFixed(1)} ${errToY(ERR[a - 1]).toFixed(1)}`;
      for (let i = a + 1; i <= Math.min(end, NB); i++) {
        d += ` L ${iterToX(i).toFixed(1)} ${errToY(ERR[i - 1]).toFixed(1)}`;
      }
      if (end < NB && f > 0 && tip > a) {
        const e = lerp(ERR[end - 1], ERR[end], f);
        const x = iterToX(end + f);
        d += ` L ${x.toFixed(1)} ${errToY(e).toFixed(1)}`;
        return { d, x, y: errToY(e), e };
      }
      const c = Math.max(a, Math.min(end, NB));
      return { d, x: iterToX(c), y: errToY(ERR[c - 1]), e: ERR[c - 1] };
    }

    let progress = 1;          // current iteration tip (float, 1..20)
    const speed = 0.0030;      // iters per ms → ~6.3s for the full path
    let last = performance.now();
    let pause = 0;

    function tick(now) {
      const dt = Math.min(48, now - last);
      last = now;
      if (pause > 0) { pause -= dt; if (pause <= 0) { progress = 1; pause = 0; } }
      else { progress += speed * dt; if (progress >= NB) { progress = NB; pause = 1900; } }

      // green portion: iters 1..min(progress, STOP) — the loop converging
      const lgTip = Math.min(progress, STOP);
      const lg = segTo(1, lgTip);
      lgSeg.setAttribute('d', lg.d);
      lgArea.setAttribute('d',
        lg.d + ` L ${lg.x.toFixed(1)} ${CHART_H - PADBOT} L ${iterToX(1).toFixed(1)} ${CHART_H - PADBOT} Z`);

      // gray portion: iters STOP..progress — what the cap keeps doing after
      if (progress > STOP) {
        const cap = segTo(STOP, progress);
        capSeg.setAttribute('d', cap.d);
      } else {
        capSeg.setAttribute('d', '');
      }

      const stopped = progress >= STOP;
      // moving head: green while converging, gray once past the stop point
      const tip = segTo(1, progress);
      head.setAttribute('cx', tip.x); head.setAttribute('cy', tip.y);
      head.setAttribute('fill', stopped ? 'var(--text-3)' : 'var(--band-fast)');
      lgRing.setAttribute('opacity', stopped ? 1 : 0);
      lgGlow.setAttribute('opacity', stopped ? 1 : 0);
      lgChip.classList.toggle('is-on', stopped);

      // cap chip rides the gray head (only after the stop point)
      const atEnd = progress >= NB;
      if (progress > STOP + 0.15) {
        capChip.style.display = '';
        const anchor = tip.x > CHART_W * 0.6 ? 'left' : tip.x < CHART_W * 0.14 ? 'right' : 'center';
        place(capChip, tip.x, tip.y, { anchor, below: true });
        capChip.textContent = atEnd ? '✗ max_iter=20 keeps err 9' : `err ${Math.round(tip.e)}`;
        capChip.classList.toggle('is-broken', atEnd);
      } else {
        capChip.style.display = 'none';
      }

      // foot numbers
      const capIterNow = Math.min(NB, Math.max(1, Math.ceil(progress)));
      capIterEl.textContent = 'iter ' + capIterNow;
      capCostEl.textContent = fmt$(PER * capIterNow);
      capVerdict.textContent = atEnd ? '✗ broken' : 'running…';
      capVerdict.classList.toggle('is-on', atEnd);

      // savings grows as the cap keeps burning past LoopGain's stop
      const capCostNow = PER * capIterNow;
      savedPctEl.textContent = (stopped && capCostNow > LG_COST)
        ? Math.round((1 - LG_COST / capCostNow) * 100) + '%' : '—';

      requestAnimationFrame(tick);
    }
    requestAnimationFrame((t) => { last = t; tick(t); });
  }
})();
