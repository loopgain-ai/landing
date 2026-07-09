/**
 * Thin Worker in front of the static landing site. Its only job: generate a
 * per-request nonce, add it to the CSP header's script-src, and stamp it onto
 * the Cloudflare Turnstile <script> tag — Turnstile's api.js reads that nonce
 * off its own script tag and propagates it to the inline script it injects
 * for the Private Access Token challenge, which a strict CSP otherwise blocks.
 * Every other response (non-HTML, or HTML with no Turnstile tag) passes
 * through untouched. See developers.cloudflare.com/turnstile/reference/content-security-policy/.
 */
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return res;

    const nonce = generateNonce();
    const headers = new Headers(res.headers);
    const csp = headers.get("content-security-policy");
    if (csp) {
      headers.set(
        "content-security-policy",
        csp.replace(/script-src ([^;]*)/, (_match, sources) => `script-src ${sources} 'nonce-${nonce}'`),
      );
    }

    const rewriter = new HTMLRewriter().on(
      'script[src*="challenges.cloudflare.com/turnstile"]',
      {
        element(el) {
          el.setAttribute("nonce", nonce);
        },
      },
    );

    return rewriter.transform(
      new Response(res.body, { status: res.status, statusText: res.statusText, headers }),
    );
  },
};

function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
