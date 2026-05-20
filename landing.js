/* LoopGain landing — minimal vanilla JS.
   - theme toggle (dark by default; light only via explicit user click)
   - copy-to-clipboard for inline pip box + code panels
   - tabbed code panels
   - animated hero convergence chart (renders points 1..20 then loops back)
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

  // ─────────── hero animated convergence chart ───────────
  // Y axis maps band ranges into 0..360 (chart svg height) inverted: 0 = top (DIVERGING).
  // Bands by flex weights in CSS: div=0.9, osc=1, stall=1, conv=1.6, fast=1.6 → total 6.1
  // So thresholds (from top in chart-space):
  //  DIVERGING band:    0     ..  53.1
  //  OSCILLATING band: 53.1   .. 112.1
  //  STALLING band:   112.1   .. 171.1
  //  CONVERGING band: 171.1   .. 265.5
  //  FAST_CONVERGE:   265.5   .. 360
  // We interpret y purely as a smoothed Aβ value for visual purposes.

  // We pre-script 24 iterations: a healthy convergence that briefly stalls,
  // recovers, and lands in FAST_CONVERGE. Numbers chosen for narrative.
  const series = [
    /* Aβ_smooth,  ε (error 0..1)  */
    { ab: 0.62, eps: 0.92 },
    { ab: 0.55, eps: 0.51 },
    { ab: 0.48, eps: 0.25 },
    { ab: 0.52, eps: 0.13 },
    { ab: 0.71, eps: 0.092 },
    { ab: 0.84, eps: 0.077 },
    { ab: 0.88, eps: 0.068 },   // brief STALL
    { ab: 0.81, eps: 0.055 },
    { ab: 0.62, eps: 0.034 },
    { ab: 0.45, eps: 0.015 },
    { ab: 0.28, eps: 0.0042 },  // FAST_CONVERGE landing
    { ab: 0.21, eps: 0.0009 },
  ];
  const N = series.length;
  const CHART_W = 600, CHART_H = 360;
  const PADX = 30;

  // Map an Aβ value to a y-coord. Linear mapping from ab=0 (bottom) to
  // ab=1.20 (top). Band-rail flex weights in CSS are sized to match the
  // actual Aβ widths of each band, so the data line lands inside its
  // colored stripe (e.g. ab=0.88 → STALL amber).
  //
  // Note: this is intentionally LINEAR for the landing's marketing
  // chart, while the dashboard's Convergence Profiles panel uses log Y
  // (because real fleet data spans orders of magnitude). The 12-point
  // demo trajectory here doesn't have that spread, and log Y compressed
  // STALL/OSC into unreadable slivers — see the deploy topology memo.
  function abToY(ab) {
    const top = 8, bot = CHART_H - 8;
    const ab_min = 0, ab_max = 1.20;
    const t = Math.min(1, Math.max(0, (ab - ab_min) / (ab_max - ab_min)));
    return bot - t * (bot - top);
  }
  function idxToX(i) {
    return PADX + (i / (N - 1)) * (CHART_W - PADX * 2);
  }

  function bandFor(ab) {
    if (ab < 0.30) return { id: 'fast',  name: 'FAST_CONVERGE' };
    if (ab < 0.85) return { id: 'conv',  name: 'CONVERGING'    };
    if (ab < 0.95) return { id: 'stall', name: 'STALLING'      };
    if (ab < 1.05) return { id: 'osc',   name: 'OSCILLATING'   };
    return            { id: 'div',   name: 'DIVERGING'     };
  }

  const line = document.getElementById('chartLine');
  const area = document.getElementById('chartArea');
  const head = document.getElementById('chartHead');
  const headG = document.getElementById('chartHeadGlow');
  const iterNum = document.getElementById('iterNum');
  const abNum   = document.getElementById('abNum');
  const epsNum  = document.getElementById('epsNum');
  const etaNum  = document.getElementById('etaNum');
  const readout = document.getElementById('bandReadout');

  // Line is drawn as a pool of `<path>` segments inside the line group.
  // Each data-point pair is split at every band-boundary crossing (0.30 /
  // 0.85 / 0.95 / 1.05), and each resulting sub-segment is colored by the
  // band of its midpoint Aβ. The pool grows on demand and unused entries
  // are cleared each frame.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BAND_BOUNDARIES = [0.30, 0.85, 0.95, 1.05];
  const segPool = [];
  function takeSeg(used) {
    if (used < segPool.length) return segPool[used];
    const seg = document.createElementNS(SVG_NS, 'path');
    if (line) line.appendChild(seg);
    segPool.push(seg);
    return seg;
  }
  function clearSegsFrom(used) {
    for (let i = used; i < segPool.length; i++) {
      segPool[i].setAttribute('d', '');
    }
  }
  // Split a linear segment from (x1, ab1) to (x2, ab2) at every band
  // boundary it crosses. Returns pieces in order, each {x1, ab1, x2, ab2}.
  function splitAtBoundaries(x1, ab1, x2, ab2) {
    if (ab1 === ab2) return [{ x1, ab1, x2, ab2 }];
    const crossings = [];
    for (const b of BAND_BOUNDARIES) {
      const t = (b - ab1) / (ab2 - ab1);
      if (t > 0 && t < 1) crossings.push({ t, ab: b });
    }
    if (crossings.length === 0) return [{ x1, ab1, x2, ab2 }];
    crossings.sort((a, b) => a.t - b.t);
    const out = [];
    let prevT = 0, prevAb = ab1;
    for (const c of crossings) {
      out.push({
        x1: x1 + prevT * (x2 - x1), ab1: prevAb,
        x2: x1 + c.t   * (x2 - x1), ab2: c.ab,
      });
      prevT = c.t; prevAb = c.ab;
    }
    out.push({
      x1: x1 + prevT * (x2 - x1), ab1: prevAb,
      x2, ab2,
    });
    return out;
  }
  function drawSegment(used, x1, ab1, x2, ab2) {
    const y1 = abToY(ab1), y2 = abToY(ab2);
    const seg = takeSeg(used);
    seg.setAttribute('d', `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`);
    const midAb = (ab1 + ab2) / 2;
    seg.setAttribute('stroke', `var(--band-${bandFor(midAb).id})`);
    return used + 1;
  }

  if (line && head && readout) {
    let progress = 0;   // float 0..N-1 (current "tip" along the series)
    const speed = 0.018; // iterations per frame at 60fps ≈ 0.5 iter / 28ms-ish
    let last = performance.now();
    let pause = 0;       // frames of pause at the end of run

    function lerp(a, b, t) { return a + (b - a) * t; }

    function tick(now) {
      const dt = Math.min(48, now - last);
      last = now;

      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) {
          progress = 0;
          pause = 0;
        }
      } else {
        progress += speed * (dt / 16.67);
        if (progress >= N - 1) {
          progress = N - 1;
          pause = 1400; // hold at end before restarting
        }
      }

      // Build path up to current tip (interpolated)
      const tip = Math.min(progress, N - 1);
      const iTip = Math.floor(tip);
      const f = tip - iTip;

      // Interpolate ab/eps between iTip and iTip+1
      const cur = series[iTip];
      const nxt = series[Math.min(N - 1, iTip + 1)];
      const ab = lerp(cur.ab, nxt.ab, f);
      const eps = Math.max(0, lerp(cur.eps, nxt.eps, f));
      const x = idxToX(tip);
      const y = abToY(ab);

      // Walk each data-point segment, split it at any band boundary it
      // crosses, and draw each piece in its own band color. Pieces are
      // taken from a pool; unused pool entries get cleared at the end so
      // there's no stale path from a previous frame.
      let used = 0;
      for (let i = 0; i < N - 1; i++) {
        let segX1, segAb1, segX2, segAb2;
        if (i < iTip) {
          segX1 = idxToX(i);     segAb1 = series[i].ab;
          segX2 = idxToX(i + 1); segAb2 = series[i + 1].ab;
        } else if (i === iTip) {
          segX1 = idxToX(i);     segAb1 = series[i].ab;
          segX2 = x;             segAb2 = ab;
        } else {
          break; // nothing more to draw this frame
        }
        const pieces = splitAtBoundaries(segX1, segAb1, segX2, segAb2);
        for (const p of pieces) {
          used = drawSegment(used, p.x1, p.ab1, p.x2, p.ab2);
        }
      }
      clearSegsFrom(used);

      // area: independent of the line color — a single filled path under
      // the curve, using the static convFill gradient defined in the SVG.
      let areaD = `M ${idxToX(0).toFixed(1)} ${abToY(series[0].ab).toFixed(1)}`;
      for (let i = 1; i <= iTip; i++) {
        areaD += ` L ${idxToX(i).toFixed(1)} ${abToY(series[i].ab).toFixed(1)}`;
      }
      areaD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      areaD += ` L ${x.toFixed(1)} ${CHART_H} L ${idxToX(0).toFixed(1)} ${CHART_H} Z`;
      area.setAttribute('d', areaD);

      // head
      head.setAttribute('cx', x);
      head.setAttribute('cy', y);
      headG.setAttribute('cx', x);
      headG.setAttribute('cy', y);

      // readout text
      const band = bandFor(ab);
      const bandClass = 'mono band-readout is-' + band.id;
      if (readout.className !== bandClass) readout.className = bandClass;
      readout.textContent = band.name;

      // Head dot follows the current tip's band. Line segments are
      // colored individually in the loop above.
      head.setAttribute('fill',   `var(--band-${band.id})`);
      headG.setAttribute('fill',  `var(--band-${band.id})`);

      // Foot numbers
      iterNum.textContent = String(iTip + 1).padStart(2, '0');
      abNum.textContent = ab.toFixed(2);
      // format eps in either fixed or scientific
      epsNum.textContent = eps >= 0.01 ? eps.toFixed(3) : eps.toExponential(1).replace('+', '');
      // eta: log(target/eps) / log(ab)  → expressed as iterations to reach 0.001
      const target = 0.001;
      let eta = '—';
      if (ab > 0 && ab < 1 && eps > target) {
        const e = Math.log(target / eps) / Math.log(ab);
        if (isFinite(e) && e > 0 && e < 60) eta = e.toFixed(1) + ' iter';
        else if (isFinite(e) && e <= 0) eta = '✓ at target';
      } else if (eps <= target) {
        eta = '✓ at target';
      }
      etaNum.textContent = eta;
      // Highlight the ETA cell when the loop is at target so the
      // success state pops visually (styled via .is-at-target in CSS).
      etaNum.classList.toggle('is-at-target', eta === '✓ at target');

      requestAnimationFrame(tick);
    }
    requestAnimationFrame((t) => { last = t; tick(t); });
  }
})();
