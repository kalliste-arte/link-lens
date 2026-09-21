(function () {
  "use strict";

  const defaults = { warnClicks: true, warnDownloads: true, externalReputation: false, privacyMode: true, allowlist: [] };
  const controls = ["warnClicks", "warnDownloads", "privacyMode", "externalReputation"];

  function saveSettings() {
    const settings = Object.fromEntries(controls.map((id) => [id, document.getElementById(id).checked]));
    settings.allowlist = document.getElementById("allowlist").value.split(",").map((domain) => domain.trim().toLowerCase()).filter(Boolean);
    chrome.storage.sync.set(settings);
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "UPDATE_SETTINGS", settings }).catch(() => {});
    });
  }

  chrome.storage.sync.get(defaults, (settings) => {
    controls.forEach((id) => { document.getElementById(id).checked = settings[id]; });
    document.getElementById("allowlist").value = settings.allowlist.join(", ");
  });
  controls.forEach((id) => document.getElementById(id).addEventListener("change", saveSettings));
  document.getElementById("allowlist").addEventListener("change", saveSettings);

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "GET_SUMMARY" }).then((summary) => {
      document.getElementById("summary").textContent = `${summary.total} links scanned · ${summary.flagged} flagged · ${summary.high} high risk`;
    }).catch(() => {
      document.getElementById("summary").textContent = "This page cannot be scanned. Try a normal webpage and refresh it.";
    });
  });
})();