/* Single source of truth for the displayed LoopGain *library* version across
   every landing page. Fetches the live version from PyPI and writes it into:
     [data-lg-version]      -> full "v<version>"  (e.g. nav badges)
     [data-lg-version-num]  -> bare "<version>"   (when embedded in other text)
     JSON-LD "softwareVersion" in any SoftwareApplication structured-data block
   The hardcoded version in each page's HTML is the fallback: on any failure
   (offline, PyPI down, CSP) the page keeps showing it — never blank. Those
   fallbacks are also rewritten from PyPI at deploy time by
   `scripts/sync-version.mjs` (see .github/workflows/deploy.yml), so the
   shipped HTML is correct even before this script runs.
   Safe to include on any page; it only touches elements that exist.

   NOTE: this is the LIBRARY (`loopgain` on PyPI) version — the product the
   landing site markets. It is intentionally NOT the dashboard's own version. */
(function syncLoopGainVersion() {
  function applyVersion(v) {
    if (!v) return; // keep the hardcoded fallback
    document.querySelectorAll("[data-lg-version]").forEach((el) => { el.textContent = "v" + v; });
    document.querySelectorAll("[data-lg-version-num]").forEach((el) => { el.textContent = v; });
    // Patch JSON-LD structured data. version-sync's element selectors can't
    // reach inside a <script type="application/ld+json"> block, so do it here:
    // parse each block, and if it declares a softwareVersion, refresh it.
    document.querySelectorAll('script[type="application/ld+json"]').forEach((node) => {
      try {
        const data = JSON.parse(node.textContent);
        const items = Array.isArray(data) ? data : [data];
        let changed = false;
        items.forEach((item) => {
          if (item && typeof item === "object" && "softwareVersion" in item && item.softwareVersion !== v) {
            item.softwareVersion = v;
            changed = true;
          }
        });
        if (changed) node.textContent = JSON.stringify(Array.isArray(data) ? items : items[0], null, 2);
      } catch (_) { /* leave malformed/non-matching blocks untouched */ }
    });
  }

  fetch("https://pypi.org/pypi/loopgain/json", { cache: "force-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => applyVersion(d && d.info && d.info.version))
    .catch(() => { /* keep the hardcoded fallback */ });
})();
