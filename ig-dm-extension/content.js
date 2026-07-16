// IG DM Auto-Recovery — Chrome Extension (Manifest V3)
// Injects saved script into page context via <script> tag
// (eval() is blocked in MV3 isolated-world content scripts)
(function () {
  'use strict';

  var DELAY_MS = 2500;
  var MARKER_ID = '__ig_dm_recovery_marker';

  function recoverScript() {
    try {
      // Prevent duplicate injection within same page session
      if (document.getElementById(MARKER_ID)) return;

      var code = sessionStorage.getItem('igDmScript');
      if (!code || code.length <= 100) return;

      console.log(
        '%c[IG-DM-EXT] 🔄 Script guardado detectado (' + code.length + ' chars). Auto-inyectando...',
        'color:#4CAF50;font-weight:bold'
      );

      // Inject into page context via <script> tag.
      // This executes in the page's MAIN world, bypassing MV3 CSP
      // restrictions that block eval() in the isolated content-script world.
      var script = document.createElement('script');
      script.textContent = code;
      (document.head || document.documentElement).appendChild(script);
      script.remove();

      // Leave a hidden DOM marker — prevents re-injection during SPA
      // navigation within Instagram. Marker survives until page reload.
      var marker = document.createElement('div');
      marker.id = MARKER_ID;
      marker.style.display = 'none';
      (document.body || document.documentElement).appendChild(marker);

      console.log('%c[IG-DM-EXT] ✓ Script inyectado exitosamente', 'color:#4CAF50;font-weight:bold');
    } catch (e) {
      console.error('[IG-DM-EXT] Error en recoverScript:', e.message);
    }
  }

  // ── Main: schedule recovery after Instagram's React app renders ──
  if (document.readyState === 'complete') {
    setTimeout(recoverScript, DELAY_MS);
  } else {
    window.addEventListener('load', function () {
      setTimeout(recoverScript, DELAY_MS);
    });
  }

  // ── SPA navigation: poll for URL changes back to /direct/ ──
  // Instagram is a React SPA; pushState/replaceState don't trigger
  // content-script re-injection. Poll to catch navigations within /direct/.
  var lastUrl = location.href;
  setInterval(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (/\/direct\//.test(location.pathname)) {
        setTimeout(recoverScript, DELAY_MS);
      }
    }
  }, 2000);
})();
