// Auto-recovery: if there's a saved script in sessionStorage, re-inject it
(function () {
  // Wait for Instagram to fully load
  setTimeout(function () {
    try {
      var code = sessionStorage.getItem('igDmScript');
      if (code && code.length > 100) {
        console.log('%c[IG-DM-EXT] Script guardado detectado. Auto-inyectando...', 'color:#4CAF50;font-weight:bold');
        eval(code);
      }
    } catch (e) {
      console.log('[IG-DM-EXT] Error auto-inyectando:', e.message);
    }
  }, 3000);
})();
