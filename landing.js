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

  // ─────────── hero chart: two real runs, same task (bench seed 34) ───────────
  // Two SEPARATE real benchmark trials of one task
  // (`w1-codegen-langgraph-claude-haiku-4-5-seed34`), drawn as two lines:
  //   • LoopGain run:    error_history = [3, 0] — drops to err 0 at iter 2, the
  //     classifier fires TARGET_MET, the loop STOPS and keeps the working output.
  //     real measured cost_usd.LG = $0.004968.
  //   • max_iter=20 run: error_history =
  //     [3,11,0,2,11,0,11,0,11,3,0,11,5,11,11,0,0,2,0,11] — bounces between
  //     correct and broken for all 20 iters and SHIPS err 11 (broken) at iter 20.
  //     real measured cost_usd.B20 = $0.058293.
  //   → saved = $0.058293 − $0.004968 = $0.053325 on this trial.
  //
  // Costs are the REAL measured cost_usd from the trial JSONL — not synthesized.
  // The displayed cost counters ease toward those measured totals as the lines
  // draw; the endpoints are exact, the in-between frames are animation only.
  //
  // Design/honesty: the RIGHT axis (error) is the only quantitative axis.
  // LoopGain's line is green (a clean FAST_CONVERGE drop to 0, then it stops);
  // the max_iter=20 baseline is gray — it has no stop signal, so it just runs
  // the cap, and its error never settles.
  const LG_ERR  = [3, 0];
  const B20_ERR = [3, 11, 0, 2, 11, 0, 11, 0, 11, 3, 0, 11, 5, 11, 11, 0, 0, 2, 0, 11];
  const NB      = B20_ERR.length;        // 20 — the iteration axis spans the baseline run
  const LG_STOP = LG_ERR.length;         // 2  — LoopGain stops here (TARGET_MET, err 0)
  const LG_COST  = 0.004968;             // real measured cost_usd.LG
  const B20_COST = 0.058293;             // real measured cost_usd.B20

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
  const lgArea  = document.getElementById('lgArea');
  const head    = document.getElementById('traceHead');   // gray — max_iter=20 head
  const lgHead  = document.getElementById('lgHead');       // green — LoopGain head
  const lgRing  = document.getElementById('lgStopRing');
  const lgGlow  = document.getElementById('lgStopGlow');
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

    // static LoopGain stop/keep marker + chip at (iter 2, err 0). The dot sits
    // at the bottom of the plot (err 0), so the chip goes top-right of it —
    // never below, where it would spill past the chart edge.
    const SX = iterToX(LG_STOP), SY = errToY(0);
    [lgRing, lgGlow].forEach(c => { c.setAttribute('cx', SX); c.setAttribute('cy', SY); });
    place(lgChip, SX, SY, { anchor: 'right' });

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

      // LoopGain line: iters 1..min(progress, LG_STOP), green, with fill under it
      const lgTip = Math.min(progress, LG_STOP);
      const lg = segTo(LG_ERR, 1, lgTip);
      lgSeg.setAttribute('d', lg.d);
      lgArea.setAttribute('d',
        lg.d + ` L ${lg.x.toFixed(1)} ${CHART_H - PADBOT} L ${iterToX(1).toFixed(1)} ${CHART_H - PADBOT} Z`);

      // max_iter=20 line: iters 1..progress, gray, never settles
      const b20 = segTo(B20_ERR, 1, progress);
      capSeg.setAttribute('d', b20.d);

      // LoopGain head (green) rides its line until it stops, then the keep marker
      // takes over at (iter 2, err 0)
      lgHead.setAttribute('cx', lg.x); lgHead.setAttribute('cy', lg.y);
      lgHead.setAttribute('opacity', stopped ? 0 : 1);
      lgRing.setAttribute('opacity', stopped ? 1 : 0);
      lgGlow.setAttribute('opacity', stopped ? 1 : 0);
      lgChip.classList.toggle('is-on', stopped);

      // max_iter=20 head (gray) rides its line; its chip trails just below
      head.setAttribute('cx', b20.x); head.setAttribute('cy', b20.y);
      if (progress > 1.15) {
        capChip.style.display = '';
        const anchor = b20.x > CHART_W * 0.6 ? 'left' : b20.x < CHART_W * 0.14 ? 'right' : 'center';
        place(capChip, b20.x, b20.y, { anchor, below: true });
        capChip.textContent = atEnd ? '✗ max_iter=20 ships err 11' : `err ${Math.round(b20.e)}`;
        capChip.classList.toggle('is-broken', atEnd);
      } else {
        capChip.style.display = 'none';
      }

      // max_iter=20 foot: iter count + cost easing to the real measured total
      const capIterNow = Math.min(NB, Math.max(1, Math.ceil(progress)));
      const capCostNow = B20_COST * (progress - 1) / (NB - 1);
      capIterEl.textContent = 'iter ' + capIterNow;
      capCostEl.textContent = fmt$(capCostNow);
      capVerdict.textContent = atEnd ? '✗ broken' : 'running…';
      capVerdict.classList.toggle('is-on', atEnd);

      // LoopGain foot: stops at iter 2; cost eases to the real measured total
      const lgIterNow = Math.min(LG_STOP, Math.max(1, Math.ceil(lgTip)));
      const lgCostNow = LG_COST * (lgTip - 1) / (LG_STOP - 1);
      lgStopIterEl.textContent = 'iter ' + lgIterNow;
      lgCostEl.textContent = fmt$(lgCostNow);
      // verdict stays "running…" until LoopGain actually stops at iter 2,
      // mirroring the cap row's "running…" → "✗ broken" reveal.
      lgVerdictEl.textContent = stopped ? '✓ best output' : 'running…';
      lgVerdictEl.classList.toggle('is-on', stopped);

      // headline savings — % less spend (real measured B20 vs LG), once LoopGain
      // has stopped and the baseline has out-spent it. The real dollar values
      // ($0.0050 / $0.0583) live in the two foot rows; this is the % of them.
      // Endpoint: 1 − 0.004968/0.058293 = 91%.
      savedPctEl.textContent = (stopped && capCostNow > LG_COST)
        ? Math.round((1 - LG_COST / capCostNow) * 100) + '%' : '—';

      requestAnimationFrame(tick);
    }
    requestAnimationFrame((t) => { last = t; tick(t); });
  }
})();
