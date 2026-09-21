(function () {
  "use strict";

  const suspiciousWords = /login|verify|account|secure|update|wallet|payment|claim|free|urgent|gift|download/i;
  const shorteners = new Set(["bit.ly", "tinyurl.com", "t.co", "is.gd", "ow.ly", "cutt.ly", "rb.gy"]);
  const defaults = { warnClicks: true, warnDownloads: true, externalReputation: false, privacyMode: true, allowlist: [] };
  let settings = { ...defaults };
  let activeLink = null;
  let tooltip = null;
  let ignoredOnce = new Set();

  function loadSettings() {
    if (!chrome?.storage?.sync) return;
    chrome.storage.sync.get(defaults, (saved) => { settings = { ...defaults, ...saved }; });
  }

  function isAllowlisted(host) {
    return settings.allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  }

  function analyzeLink(link) {
    const rawHref = link.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:")) return { score: 0, reasons: [] };

    let url;
    try { url = new URL(rawHref, window.location.href); } catch { return { score: 3, reasons: ["The link URL could not be parsed"] }; }

    const reasons = [];
    let score = 0;
    const host = url.hostname.toLowerCase();
    const label = (link.textContent || "").trim();
    const downloadable = /\.(exe|msi|scr|bat|cmd|ps1|js|vbs|zip|rar|7z)(?:$|[?#])/i.test(url.pathname);

    if (isAllowlisted(host)) return { score: 0, reasons: ["This domain is on your allowlist"], host, url, downloadable };
    if (url.protocol === "http:") { score += 1; reasons.push("HTTPS is missing"); }
    if (url.username || url.password || url.href.includes("@")) { score += 2; reasons.push("It uses a deceptive @ pattern"); }
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) { score += 2; reasons.push("It points directly to an IP address"); }
    if (host.includes("xn--")) { score += 2; reasons.push("It uses an internationalized hostname"); }
    if (shorteners.has(host)) { score += 1; reasons.push("It hides the final destination behind a URL shortener"); }
    if ([...url.searchParams.keys()].some((key) => /^(url|uri|redirect|redir|next|target|dest|destination)$/i.test(key))) { score += 1; reasons.push("It uses a redirect parameter that may hide the final destination"); }
    if (host.split(".").length > 4 || url.href.length > 180) { score += 1; reasons.push("It has an unusually complex URL"); }
    if (suspiciousWords.test(host) || suspiciousWords.test(url.pathname)) { score += 1; reasons.push("The address contains common bait words"); }
    if (label && /\.[a-z]{2,}/i.test(label) && !label.toLowerCase().includes(host)) { score += 2; reasons.push("Visible text does not match the destination"); }
    if (downloadable) { score += 2; reasons.push("It points to a potentially executable or archive download"); }

    return { score, reasons, host, url, downloadable };
  }

  function severity(score) { return score >= 5 ? "high" : score >= 3 ? "medium" : "low"; }

  function removeTooltip() { tooltip?.remove(); tooltip = null; }

  function addText(parent, tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  function showTooltip(link, result) {
    removeTooltip();
    tooltip = document.createElement("div");
    tooltip.className = `link-lens-tooltip link-lens-${severity(result.score)}`;
    addText(tooltip, "strong", `${severity(result.score).toUpperCase()} RISK`, "link-lens-title");
    addText(tooltip, "span", result.host || "Unknown destination", "link-lens-host");
    const list = document.createElement("ul");
    result.reasons.forEach((reason) => addText(list, "li", reason));
    tooltip.appendChild(list);

    const actions = document.createElement("div");
    actions.className = "link-lens-actions";
    if (settings.externalReputation && !settings.privacyMode && result.url) {
      const reputation = addText(actions, "button", "Check reputation", "link-lens-action");
      reputation.addEventListener("click", () => window.open(`https://transparencyreport.google.com/safe-browsing/search?url=${encodeURIComponent(result.url.href)}`, "_blank", "noopener"));
    }
    const ignore = addText(actions, "button", "Ignore once", "link-lens-action");
    ignore.addEventListener("click", () => { ignoredOnce.add(link); removeTooltip(); link.classList.remove("link-lens-warning"); });
    tooltip.appendChild(actions);
    document.body.appendChild(tooltip);

    const box = link.getBoundingClientRect();
    tooltip.style.left = `${Math.min(window.innerWidth - 320, Math.max(8, box.left))}px`;
    tooltip.style.top = `${Math.min(window.innerHeight - 190, box.bottom + 10)}px`;
  }

  function onPointerOver(event) {
    const link = event.target.closest?.("a[href]");
    if (!link || link === activeLink) return;
    activeLink = link;
    const result = analyzeLink(link);
    const shouldWarn = result.score >= 2 && !ignoredOnce.has(link);
    link.className = link.className.replace(/\blink-lens-(?:low|medium|high|warning)\b/g, "");
    if (shouldWarn) { link.classList.add(`link-lens-${severity(result.score)}`); showTooltip(link, result); }
  }

  function onPointerOut(event) {
    if (!activeLink || event.target.closest?.("a[href]") !== activeLink || event.relatedTarget === tooltip) return;
    activeLink.classList.remove("link-lens-low", "link-lens-medium", "link-lens-high", "link-lens-warning");
    activeLink = null;
    removeTooltip();
  }

  function handleClick(event) {
    const link = event.target.closest?.("a[href]");
    if (!link || !settings.warnClicks || ignoredOnce.has(link)) return;
    const result = analyzeLink(link);
    if (result.downloadable) return;
    if (result.score < 5) return;
    event.preventDefault();
    const confirmed = window.confirm(`Link Lens: high-risk link\n\nDestination: ${result.host}\n\n${result.reasons.join("\n")}\n\nOpen it anyway?`);
    if (confirmed) { ignoredOnce.add(link); window.location.href = link.href; }
  }

  function handleDownload(event) {
    if (!settings.warnDownloads) return;
    const link = event.target.closest?.("a[href]");
    if (!link) return;
    const result = analyzeLink(link);
    if (!result.downloadable || ignoredOnce.has(link)) return;
    event.preventDefault();
    if (window.confirm(`This link downloads a potentially risky file.\n\nDestination: ${result.host}\n\nContinue?`)) { ignoredOnce.add(link); window.location.href = link.href; }
  }

  function pageSummary() {
    const links = [...document.querySelectorAll("a[href]")];
    const flagged = links.map(analyzeLink).filter((result) => result.score >= 2);
    return { total: links.length, flagged: flagged.length, high: flagged.filter((result) => result.score >= 5).length };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_SUMMARY") sendResponse(pageSummary());
    if (message.type === "UPDATE_SETTINGS") { settings = { ...settings, ...message.settings }; }
    return true;
  });

  loadSettings();
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("click", handleDownload, true);
})();