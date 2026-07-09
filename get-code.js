/* "Try it on your own code" savings demo (/get-code).
   Posts to the first-party capture Worker at loopgain.ai/api/analyze
   (same-origin). Own Turnstile callback (onloadTurnstileCallbackSC) so it
   doesn't collide with landing.js's dialog-scoped onloadTurnstileCallback —
   both can be defined; the api.js script tag on this page only ever calls
   the SC one. */
(() => {
  const API = '/api/analyze';
  const TURNSTILE_SITEKEY = '0x4AAAAAADiBMO_v3Ti_3EcA';

  // Published, independently-verified aggregate figures (benchmarks.html) —
  // fixed constants, never model-generated. Pairs their own extracted cap
  // (a literal fact read off their pasted code) with the benchmark's own
  // published before/after, so the reveal is concrete without ever
  // fabricating a savings number for their specific code.
  const BENCH_MEAN_ITERATIONS = '1.6';
  const BENCH_COST_CUT = '92.8%';
  const BENCH_SPEEDUP = '~15×';

  // Lines that are LoopGain's own addition to the user's original loop —
  // matched by the exact API surface the system prompt instructs the model
  // to use (from loopgain import / guard = LoopGain(...) / guard.*).
  const LG_LINE_PATTERN = /\bguard\b|\bLoopGain\b|\bloopgain\b/;
  function highlightWrappedCode(code) {
    return code.split('\n').map((line) => {
      const escaped = escapeHtml(line);
      return LG_LINE_PATTERN.test(line) ? `<span class="sc-lg-line">${escaped}</span>` : escaped;
    }).join('\n');
  }

  const form = document.getElementById('scForm');
  if (!form) return; // this script only runs on /get-code

  const codeEl = document.getElementById('scCode');
  const codeCountEl = document.getElementById('scCodeCount');
  const emailEl = document.getElementById('scEmail');
  const consentEl = document.getElementById('scConsent');
  const statusEl = document.getElementById('scStatus');
  const submitBtn = form.querySelector('.sc-submit');
  const resultSection = document.getElementById('scResult');
  const resultInner = document.getElementById('scResultInner');

  /* Model-provided strings (message, savings note, wrapped_code) are
     untrusted content rendered as HTML — always escape before inserting,
     including inside <pre> blocks (real code legitimately contains
     <, >, & that must render literally, not as markup). */
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  if (codeEl && codeCountEl) {
    const updateCount = () => { codeCountEl.textContent = String(codeEl.value.length); };
    codeEl.addEventListener('input', updateCount);
    updateCount();
  }

  /* Turnstile — explicit render, single widget, no dialog-lazy-render
     complexity needed since this is a standalone page, not a modal. */
  let scWidget = null;

  window.onloadTurnstileCallbackSC = () => {
    const slot = document.getElementById('scTurnstile');
    if (!slot) return;
    scWidget = turnstile.render(slot, {
      sitekey: TURNSTILE_SITEKEY, appearance: 'interaction-only', theme: 'auto',
    });
  };

  function turnstileToken() {
    if (!window.turnstile || scWidget === null) return '';
    try { return turnstile.getResponse(scWidget) || ''; } catch { return ''; }
  }

  function turnstileReset() {
    if (!window.turnstile || scWidget === null) return;
    try { turnstile.reset(scWidget); } catch { /* widget gone — ignore */ }
  }

  function setStatus(text, kind) {
    statusEl.textContent = text || '';
    statusEl.className = 'sc-status' + (kind ? ` is-${kind}` : '');
  }

  function copyBlock(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      const original = btn.textContent;
      btn.textContent = 'copied ✓';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = original; }, 1800);
    }).catch(() => {});
  }

  function renderResult(data) {
    const parts = [];

    if (data.loop_detected) {
      parts.push('<div class="sc-result-banner detected">loop detected</div>');
    } else {
      parts.push('<div class="sc-result-banner not-detected">no loop detected</div>');
    }

    parts.push(`<p class="sc-result-message">${escapeHtml(data.message)}</p>`);

    if (data.wrapped_code) {
      parts.push('<p class="sc-code-label">Here\'s your loop, rewritten with LoopGain — ready to paste in</p>');
      parts.push(
        '<div class="sc-code-block">' +
        '<button type="button" class="sc-copy-btn" data-copy-code>copy</button>' +
        `<pre><code>${highlightWrappedCode(data.wrapped_code)}</code></pre>` +
        '</div>',
      );
      if (data.review_disclaimer) {
        parts.push(`<p class="sc-disclaimer">${escapeHtml(data.review_disclaimer)}</p>`);
      }
    }

    if (data.loop_detected && data.estimated_savings_note) {
      parts.push(`<div class="sc-savings-note">${escapeHtml(data.estimated_savings_note)}</div>`);
    }

    if (data.loop_detected) {
      const beforeNum = Number.isFinite(data.detected_cap) ? String(data.detected_cap) : null;
      parts.push('<p class="sc-section-label">Why it matters — published benchmark data</p>');
      parts.push(
        '<div class="sc-reveal">' +
        '<div class="sc-reveal-side">' +
        `<span class="sc-reveal-num">${beforeNum ? escapeHtml(beforeNum) : '?'}</span>` +
        `<span class="sc-reveal-label">${beforeNum ? 'iterations your loop runs every time' : 'no fixed cap — runs until something says stop'}</span>` +
        '</div>' +
        '<div class="sc-reveal-arrow">→</div>' +
        '<div class="sc-reveal-side accent">' +
        `<span class="sc-reveal-num">${BENCH_MEAN_ITERATIONS}</span>` +
        '<span class="sc-reveal-label">mean iterations to best output — published aggregate, same max_iter=20 baseline, 2,000 real-API trials</span>' +
        '</div>' +
        '</div>' +
        `<p class="sc-reveal-foot">${BENCH_COST_CUT} less spend · ${BENCH_SPEEDUP} faster wall-clock, aggregate across the same benchmark, not a measurement of your code above — <a href="/benchmarks" target="_blank" rel="noopener">see the full data</a>.</p>`,
      );
    }

    if (data.dashboard_status === 'active') {
      parts.push(
        '<div class="sc-dashboard-box">' +
        '<h3>Free hosted dashboard access</h3>' +
        '<p>You already have free hosted-dashboard access for this email — check your earlier confirmation email for your token, or head to ' +
        '<a href="https://dashboard.loopgain.ai" rel="noopener">dashboard.loopgain.ai</a>.</p>' +
        '</div>',
      );
    } else if (data.dashboard_status === 'confirm_sent') {
      parts.push(
        '<div class="sc-dashboard-box">' +
        '<h3>Free hosted dashboard access</h3>' +
        '<p>Check your email — click the confirmation link to activate it and get your access token. That proves the email is really yours before we hand out a credential.</p>' +
        '</div>',
      );
    } else if (data.dashboard_status === 'confirm_pending') {
      parts.push(
        '<div class="sc-dashboard-box">' +
        '<h3>Free hosted dashboard access</h3>' +
        '<p>Your request is on file — we\'ll follow up separately once activation is ready.</p>' +
        '</div>',
      );
    }

    parts.push(
      '<div class="sc-try" style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">' +
      '<div class="copy-box copy-box-sm" data-copy="pip install loopgain" role="button" tabindex="0">' +
      '<span class="copy-prompt mono">$</span><code class="mono">pip install loopgain</code><span class="copy-hint mono">copy</span>' +
      '</div>' +
      '<a class="btn btn-ghost" href="mailto:hello&#64;loopgain&#46;ai?subject=Savings%20check%20follow-up" rel="noopener">questions? talk to us →</a>' +
      '</div>',
    );

    resultInner.innerHTML = parts.join('\n');
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const codeCopyBtn = resultInner.querySelector('[data-copy-code]');
    if (codeCopyBtn) codeCopyBtn.addEventListener('click', () => copyBlock(data.wrapped_code, codeCopyBtn));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (fd.get('company_website')) return; // honeypot tripped — silently do nothing

    const email = (fd.get('email') || '').toString().trim();
    const code = (fd.get('code') || '').toString().trim();
    const consent = consentEl ? consentEl.checked : false;

    if (!email) { setStatus('Enter your email first.', 'err'); return; }
    if (!consent) { setStatus('Please agree to be contacted about your results.', 'err'); return; }
    if (!code) { setStatus('Paste a loop example first.', 'err'); return; }

    submitBtn.disabled = true;
    setStatus('Analyzing your loop — this takes a few seconds…', 'pending');
    resultSection.hidden = true;

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, code, consent: true,
          source: 'landing:get-code',
          company_website: '',
          cf_turnstile_response: turnstileToken(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(data.error || 'Something went wrong — please try again.', 'err');
        turnstileReset();
        return;
      }
      setStatus('', null);
      renderResult(data);
    } catch {
      setStatus('Network error — please try again.', 'err');
      turnstileReset();
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
