/* Single source of truth for the displayed LoopGain *library* version across
   every landing page. Fetches the live version from PyPI and writes it into:
     [data-lg-version]      -> full "v<version>"  (e.g. nav badges)
     [data-lg-version-num]  -> bare "<version>"   (when embedded in other text)
   The hardcoded version in each page's HTML is the fallback: on any failure
   (offline, PyPI down, CSP) the page keeps showing it — never blank.
   Safe to include on any page; it only touches elements that exist.

   NOTE: this is the LIBRARY (`loopgain` on PyPI) version — the product the
   landing site markets. It is intentionally NOT the dashboard's own version. */
(function syncLoopGainVersion() {
  fetch("https://pypi.org/pypi/loopgain/json", { cache: "force-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const v = d && d.info && d.info.version;
      if (!v) return; // keep the hardcoded fallback
      document.querySelectorAll("[data-lg-version]").forEach((el) => { el.textContent = "v" + v; });
      document.querySelectorAll("[data-lg-version-num]").forEach((el) => { el.textContent = v; });
    })
    .catch(() => { /* keep the hardcoded fallback */ });
})();
