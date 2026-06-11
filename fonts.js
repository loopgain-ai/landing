/* Non-blocking Google Fonts activation. The font CSS is fetched via
   <link rel="preload" as="style" data-font-css> so it never blocks first
   paint; this flips it to an active stylesheet once JS runs. A separate
   file (not inline) because our CSP allows script-src 'self' only — an
   inline onload handler would be blocked. <noscript> fallback in each page. */
document.querySelectorAll("link[data-font-css]").forEach(function (l) {
  l.rel = "stylesheet";
  l.removeAttribute("as");
});
