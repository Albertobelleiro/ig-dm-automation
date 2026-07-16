// chrome.storage.local wrappers for IG DM Automator
// Keys: 'igDmConfig', 'igDmProgress', 'igDmSession'
var Storage = {
  // ── Config ──
  getConfig: function () {
    return chrome.storage.local.get('igDmConfig').then(function (data) {
      return data.igDmConfig || null;
    });
  },

  setConfig: function (config) {
    return chrome.storage.local.set({ igDmConfig: config });
  },

  // ── Progress ──
  getProgress: function () {
    return chrome.storage.local.get('igDmProgress').then(function (data) {
      return data.igDmProgress || null;
    });
  },

  setProgress: function (progress) {
    return chrome.storage.local.set({ igDmProgress: progress });
  },

  // ── Session (recovery) ──
  getSession: function () {
    return chrome.storage.local.get('igDmSession').then(function (data) {
      return data.igDmSession || null;
    });
  },

  setSession: function (session) {
    return chrome.storage.local.set({ igDmSession: session });
  },

  clearSession: function () {
    return chrome.storage.local.remove('igDmSession');
  },

  // ── Initialize defaults ──
  initDefaults: function () {
    return chrome.storage.local.get(['igDmConfig', 'igDmProgress']).then(function (data) {
      var promises = [];
      if (!data.igDmConfig) {
        promises.push(chrome.storage.local.set({ igDmConfig: DEFAULTS }));
      }
      if (!data.igDmProgress) {
        promises.push(chrome.storage.local.set({ igDmProgress: DEFAULT_PROGRESS }));
      }
      return Promise.all(promises);
    });
  }
};
