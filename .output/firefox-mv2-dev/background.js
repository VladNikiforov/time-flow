var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  function toLocalISODate(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 6e4);
    return local.toISOString().slice(0, 10);
  }
  toLocalISODate(/* @__PURE__ */ new Date());
  async function storageGet(keys) {
    return await browser.storage.local.get(keys);
  }
  async function storageSet(items) {
    await browser.storage.local.set(items);
  }
  async function getIsPaused() {
    const result2 = await storageGet(["isPaused"]);
    return !!result2.isPaused;
  }
  async function setIsPaused(value) {
    await storageSet({ isPaused: value });
  }
  async function getData(date) {
    const result2 = await storageGet([date]);
    return result2[date] || [];
  }
  async function saveData(date, entry) {
    const existingData = await getData(date);
    existingData.push(entry);
    await storageSet({ [date]: existingData });
  }
  async function getTimerState() {
    const state = await storageGet(["startTime", "currentTabId", "currentTabUrl", "switchingTabs"]);
    return {
      startTime: state.startTime ?? 0,
      currentTabId: state.currentTabId ?? null,
      currentTabUrl: state.currentTabUrl ?? "",
      switchingTabs: state.switchingTabs ?? false
    };
  }
  async function setTimerState(state) {
    await storageSet(state);
  }
  async function resetTimerState() {
    await setTimerState({ startTime: 0, currentTabId: null, currentTabUrl: "", switchingTabs: false });
  }
  const definition = defineBackground(() => {
    const addonPageURL = browser.runtime.getURL("/main.html");
    async function startTimer(tabId) {
      if (await getIsPaused()) return;
      await setTimerState({ currentTabId: tabId });
      try {
        const tab = await browser.tabs.get(tabId);
        if (!tab.url) return;
        await setTimerState({ currentTabUrl: tab.url, startTime: Date.now() });
        console.log(`[Log] Started tracking: ${tab.url}`);
      } catch (error) {
        console.error("Failed to get tab:", error);
      }
    }
    async function stopTimer() {
      const state = await getTimerState();
      if (!state.currentTabId || !state.currentTabUrl || !state.startTime || await getIsPaused()) {
        await resetTimerState();
        return;
      }
      const endTime = Date.now();
      const elapsedSeconds = Math.floor((endTime - state.startTime) / 1e3);
      const website = state.currentTabUrl;
      if (elapsedSeconds <= 0 || website.startsWith(addonPageURL)) {
        await resetTimerState();
        return;
      }
      console.log(`[Log] Stopped tracking ${website} after ${elapsedSeconds}s`);
      const newEntry = {
        website,
        time: { start: state.startTime, end: endTime }
      };
      await saveData(toLocalISODate(/* @__PURE__ */ new Date()), newEntry);
      await sendAllStoredData();
      await resetTimerState();
    }
    async function sendAllStoredData() {
      const allData = await storageGet(null);
      const result2 = {};
      for (const [date, entries] of Object.entries(allData)) {
        if (!Array.isArray(entries)) continue;
        const validEntries = entries.filter((entry) => {
          if (!entry.website || entry.website.startsWith(addonPageURL)) return false;
          return typeof entry.time !== "number" ? entry.time.end - entry.time.start > 0 : entry.time > 0;
        });
        if (validEntries.length > 0) result2[date] = validEntries;
      }
      browser.runtime.sendMessage({ action: "sendData", data: result2 }).catch(() => {
      });
    }
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "setPause") {
        setIsPaused(!!message.value).then(() => sendResponse({ isPaused: !!message.value }));
        return true;
      }
      if (message.action === "getPause") {
        getIsPaused().then((paused) => sendResponse({ isPaused: paused }));
        return true;
      }
      if (message.action === "requestAllData") {
        sendAllStoredData();
      }
    });
    let tabSwitchTimeout = null;
    async function safeSwitch(tabId) {
      if (tabSwitchTimeout) clearTimeout(tabSwitchTimeout);
      tabSwitchTimeout = setTimeout(async () => {
        const state = await getTimerState();
        if (state.switchingTabs) return;
        await setTimerState({ switchingTabs: true });
        try {
          await stopTimer();
          await startTimer(tabId);
        } finally {
          await setTimerState({ switchingTabs: false });
        }
      }, 150);
    }
    browser.tabs.onActivated.addListener((activeInfo) => safeSwitch(activeInfo.tabId));
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      getTimerState().then((state) => {
        if (tabId === state.currentTabId && changeInfo.status === "complete" && tab.url) safeSwitch(tabId);
      });
    });
    browser.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId === browser.windows.WINDOW_ID_NONE) {
        await stopTimer();
      } else {
        try {
          const [activeTab] = await browser.tabs.query({ active: true, windowId });
          if (activeTab?.id != null) await startTimer(activeTab.id);
        } catch (e) {
          console.error("Error resuming timer on focus:", e);
        }
      }
    });
    browser.windows.onRemoved.addListener(() => stopTimer());
  });
  function initPlugins() {
  }
  var _MatchPattern = class {
    constructor(matchPattern) {
      if (matchPattern === "<all_urls>") {
        this.isAllUrls = true;
        this.protocolMatches = [..._MatchPattern.PROTOCOLS];
        this.hostnameMatch = "*";
        this.pathnameMatch = "*";
      } else {
        const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
        if (groups == null)
          throw new InvalidMatchPattern(matchPattern, "Incorrect format");
        const [_, protocol, hostname, pathname] = groups;
        validateProtocol(matchPattern, protocol);
        validateHostname(matchPattern, hostname);
        this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
        this.hostnameMatch = hostname;
        this.pathnameMatch = pathname;
      }
    }
    includes(url) {
      if (this.isAllUrls)
        return true;
      const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
      return !!this.protocolMatches.find((protocol) => {
        if (protocol === "http")
          return this.isHttpMatch(u);
        if (protocol === "https")
          return this.isHttpsMatch(u);
        if (protocol === "file")
          return this.isFileMatch(u);
        if (protocol === "ftp")
          return this.isFtpMatch(u);
        if (protocol === "urn")
          return this.isUrnMatch(u);
      });
    }
    isHttpMatch(url) {
      return url.protocol === "http:" && this.isHostPathMatch(url);
    }
    isHttpsMatch(url) {
      return url.protocol === "https:" && this.isHostPathMatch(url);
    }
    isHostPathMatch(url) {
      if (!this.hostnameMatch || !this.pathnameMatch)
        return false;
      const hostnameMatchRegexs = [
        this.convertPatternToRegex(this.hostnameMatch),
        this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))
      ];
      const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
      return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
    }
    isFileMatch(url) {
      throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
    }
    isFtpMatch(url) {
      throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
    }
    isUrnMatch(url) {
      throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
    }
    convertPatternToRegex(pattern) {
      const escaped = this.escapeForRegex(pattern);
      const starsReplaced = escaped.replace(/\\\*/g, ".*");
      return RegExp(`^${starsReplaced}$`);
    }
    escapeForRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };
  var MatchPattern = _MatchPattern;
  MatchPattern.PROTOCOLS = ["http", "https", "file", "ftp", "urn"];
  var InvalidMatchPattern = class extends Error {
    constructor(matchPattern, reason) {
      super(`Invalid match pattern "${matchPattern}": ${reason}`);
    }
  };
  function validateProtocol(matchPattern, protocol) {
    if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*")
      throw new InvalidMatchPattern(
        matchPattern,
        `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`
      );
  }
  function validateHostname(matchPattern, hostname) {
    if (hostname.includes(":"))
      throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
    if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*."))
      throw new InvalidMatchPattern(
        matchPattern,
        `If using a wildcard (*), it must go at the start of the hostname`
      );
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
    else method("[wxt]", ...args);
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  let ws;
  function getDevServerWebSocket() {
    if (ws == null) {
      const serverUrl = "ws://localhost:3000";
      logger.debug("Connecting to dev server @", serverUrl);
      ws = new WebSocket(serverUrl, "vite-hmr");
      ws.addWxtEventListener = ws.addEventListener.bind(ws);
      ws.sendCustom = (event, payload) => ws?.send(JSON.stringify({
        type: "custom",
        event,
        payload
      }));
      ws.addEventListener("open", () => {
        logger.debug("Connected to dev server");
      });
      ws.addEventListener("close", () => {
        logger.debug("Disconnected from dev server");
      });
      ws.addEventListener("error", (event) => {
        logger.error("Failed to connect to dev server", event);
      });
      ws.addEventListener("message", (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === "custom") ws?.dispatchEvent(new CustomEvent(message.event, { detail: message.data }));
        } catch (err) {
          logger.error("Failed to handle message", err);
        }
      });
    }
    return ws;
  }
  function keepServiceWorkerAlive() {
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, 5e3);
  }
  function reloadContentScript(payload) {
    if (browser.runtime.getManifest().manifest_version == 2) reloadContentScriptMv2();
    else reloadContentScriptMv3(payload);
  }
  async function reloadContentScriptMv3({ registration, contentScript }) {
    if (registration === "runtime") await reloadRuntimeContentScriptMv3(contentScript);
    else await reloadManifestContentScriptMv3(contentScript);
  }
  async function reloadManifestContentScriptMv3(contentScript) {
    const id = `wxt:${contentScript.js[0]}`;
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const existing = registered.find((cs) => cs.id === id);
    if (existing) {
      logger.debug("Updating content script", existing);
      await browser.scripting.updateContentScripts([{
        ...contentScript,
        id,
        css: contentScript.css ?? []
      }]);
    } else {
      logger.debug("Registering new content script...");
      await browser.scripting.registerContentScripts([{
        ...contentScript,
        id,
        css: contentScript.css ?? []
      }]);
    }
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadRuntimeContentScriptMv3(contentScript) {
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const matches = registered.filter((cs) => {
      const hasJs = contentScript.js?.find((js) => cs.js?.includes(js));
      const hasCss = contentScript.css?.find((css) => cs.css?.includes(css));
      return hasJs || hasCss;
    });
    if (matches.length === 0) {
      logger.log("Content script is not registered yet, nothing to reload", contentScript);
      return;
    }
    await browser.scripting.updateContentScripts(matches);
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadTabsForContentScript(contentScript) {
    const allTabs = await browser.tabs.query({});
    const matchPatterns = contentScript.matches.map((match) => new MatchPattern(match));
    const matchingTabs = allTabs.filter((tab) => {
      const url = tab.url;
      if (!url) return false;
      return !!matchPatterns.find((pattern) => pattern.includes(url));
    });
    await Promise.all(matchingTabs.map(async (tab) => {
      try {
        await browser.tabs.reload(tab.id);
      } catch (err) {
        logger.warn("Failed to reload tab:", err);
      }
    }));
  }
  async function reloadContentScriptMv2(_payload) {
    throw Error("TODO: reloadContentScriptMv2");
  }
  {
    try {
      const ws2 = getDevServerWebSocket();
      ws2.addWxtEventListener("wxt:reload-extension", () => {
        browser.runtime.reload();
      });
      ws2.addWxtEventListener("wxt:reload-content-script", (event) => {
        reloadContentScript(event.detail);
      });
      if (false) ;
    } catch (err) {
      logger.error("Failed to setup web socket connection with dev server", err);
    }
    browser.commands.onCommand.addListener((command) => {
      if (command === "wxt:reload-extension") browser.runtime.reload();
    });
  }
  let result;
  try {
    initPlugins();
    result = definition.main();
    if (result instanceof Promise) console.warn("The background's main() function return a promise, but it must be synchronous");
  } catch (err) {
    logger.error("The background crashed on startup!");
    throw err;
  }
  var background_entrypoint_default = result;
  return background_entrypoint_default;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI1X0B0eXBlcytub2RlQDI0LjEyLjJfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMi4wX3JvbGx1cEA0LjYwLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40MC9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI1X0B0eXBlcytub2RlQDI0LjEyLjJfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMi4wX3JvbGx1cEA0LjYwLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vdXRpbHMvZGF0ZS50cyIsIi4uLy4uL3V0aWxzL3N0YXRlLnRzIiwiLi4vLi4vZW50cnlwb2ludHMvYmFja2dyb3VuZC50cyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad2ViZXh0LWNvcmUrbWF0Y2gtcGF0dGVybnNAMS4wLjMvbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy91dGlscy9kZWZpbmUtYmFja2dyb3VuZC50c1xuZnVuY3Rpb24gZGVmaW5lQmFja2dyb3VuZChhcmcpIHtcblx0aWYgKGFyZyA9PSBudWxsIHx8IHR5cGVvZiBhcmcgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHsgbWFpbjogYXJnIH07XG5cdHJldHVybiBhcmc7XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGRlZmluZUJhY2tncm91bmQgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgYnJvd3NlciQxIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvYnJvd3Nlci50c1xuLyoqXG4qIENvbnRhaW5zIHRoZSBgYnJvd3NlcmAgZXhwb3J0IHdoaWNoIHlvdSBzaG91bGQgdXNlIHRvIGFjY2VzcyB0aGUgZXh0ZW5zaW9uXG4qIEFQSXMgaW4geW91ciBwcm9qZWN0OlxuKlxuKiBgYGB0c1xuKiBpbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuKlxuKiBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKCkgPT4ge1xuKiAgIC8vIC4uLlxuKiB9KTtcbiogYGBgXG4qXG4qIEBtb2R1bGUgd3h0L2Jyb3dzZXJcbiovXG5jb25zdCBicm93c2VyID0gYnJvd3NlciQxO1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBicm93c2VyIH07XG4iLCIvKiBUaW1lRmxvdyAtIGJyb3dzZXIgZXh0ZW5zaW9uOyAoYykgMjAyNCBWbGFkTmlraWZvcm92OyBHUEx2Mywgc2VlIExJQ0VOU0UgZmlsZSAqL1xuXG5pbXBvcnQgeyBWaWV3UmFuZ2UgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5cbmV4cG9ydCBmdW5jdGlvbiB0b0xvY2FsSVNPRGF0ZShkYXRlOiBEYXRlKTogc3RyaW5nIHtcbiAgY29uc3QgbG9jYWwgPSBuZXcgRGF0ZShkYXRlLmdldFRpbWUoKSAtIGRhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKSAqIDYwMDAwKTtcbiAgcmV0dXJuIGxvY2FsLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xufVxuXG5leHBvcnQgY29uc3QgdG9kYXkgPSB0b0xvY2FsSVNPRGF0ZShuZXcgRGF0ZSgpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0YXJ0T2ZXZWVrKGRhdGU6IERhdGUpOiBEYXRlIHtcbiAgY29uc3QgZGF5ID0gZGF0ZS5nZXREYXkoKTtcbiAgY29uc3QgZGlmZmVyZW5jZSA9IGRhdGUuZ2V0RGF0ZSgpIC0gKGRheSA9PT0gMCA/IDYgOiBkYXkgLSAxKTtcbiAgY29uc3Qgc3RhcnRPZldlZWsgPSBuZXcgRGF0ZShkYXRlKTtcbiAgc3RhcnRPZldlZWsuc2V0RGF0ZShkaWZmZXJlbmNlKTtcbiAgc3RhcnRPZldlZWsuc2V0SG91cnMoMCwgMCwgMCwgMCk7XG4gIHJldHVybiBzdGFydE9mV2Vlaztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0YXJ0T2ZNb250aChkYXRlOiBEYXRlKTogRGF0ZSB7XG4gIHJldHVybiBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgMSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREYXlzSW5Nb250aChkYXRlOiBEYXRlKTogbnVtYmVyIHtcbiAgcmV0dXJuIG5ldyBEYXRlKGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpICsgMSwgMCkuZ2V0RGF0ZSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJywgJ09jdCcsICdOb3YnLCAnRGVjJ107XG4gIGNvbnN0IFt5ZWFyLCBtb250aCwgZGF5XSA9IGRhdGVTdHIuc3BsaXQoJy0nKTtcbiAgY29uc3QgbW9udGhJZHggPSBwYXJzZUludChtb250aCkgLSAxO1xuICByZXR1cm4gYCR7cGFyc2VJbnQoZGF5KX0gJHttb250aHNbbW9udGhJZHhdfSAke3llYXJ9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlRGF0ZVJhbmdlKHN0YXJ0RGF0ZTogRGF0ZSwgcmFuZ2U6IFZpZXdSYW5nZSk6IHN0cmluZ1tdIHtcbiAgY29uc3QgZGF0ZVJhbmdlOiBzdHJpbmdbXSA9IFtdO1xuICBpZiAocmFuZ2UgPT09ICdXZWVrJykge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNzsgaSsrKSB7XG4gICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoc3RhcnREYXRlKTtcbiAgICAgIGRhdGUuc2V0RGF0ZShzdGFydERhdGUuZ2V0RGF0ZSgpICsgaSk7XG4gICAgICBkYXRlUmFuZ2UucHVzaCh0b0xvY2FsSVNPRGF0ZShkYXRlKSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHJhbmdlID09PSAnTW9udGgnKSB7XG4gICAgY29uc3QgZGF5c0luTW9udGggPSBnZXREYXlzSW5Nb250aChzdGFydERhdGUpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF5c0luTW9udGg7IGkrKykge1xuICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHN0YXJ0RGF0ZS5nZXRGdWxsWWVhcigpLCBzdGFydERhdGUuZ2V0TW9udGgoKSwgaSArIDEpO1xuICAgICAgZGF0ZVJhbmdlLnB1c2godG9Mb2NhbElTT0RhdGUoZGF0ZSkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBkYXRlUmFuZ2UucHVzaCh0b0xvY2FsSVNPRGF0ZShzdGFydERhdGUpKTtcbiAgfVxuICByZXR1cm4gZGF0ZVJhbmdlO1xufVxuIiwiaW1wb3J0IHsgRnVsbERhdGEsIFJhd0RhdGEgfSBmcm9tICcuL3R5cGVzJ1xuXG5leHBvcnQgY29uc3QgZnVsbERhdGE6IEZ1bGxEYXRhID0ge31cblxuZXhwb3J0IHR5cGUgU3RvcmFnZUl0ZW1zID0gUmVjb3JkPHN0cmluZywgYW55PlxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RvcmFnZUdldDxUIGV4dGVuZHMgU3RvcmFnZUl0ZW1zPihrZXlzPzogc3RyaW5nIHwgc3RyaW5nW10gfCBSZWNvcmQ8c3RyaW5nLCBhbnk+IHwgbnVsbCk6IFByb21pc2U8VD4ge1xuICByZXR1cm4gKGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5nZXQoa2V5cykpIGFzIGFueVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RvcmFnZVNldChpdGVtczogU3RvcmFnZUl0ZW1zKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoaXRlbXMpXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRJc1BhdXNlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc3RvcmFnZUdldDx7IGlzUGF1c2VkPzogYm9vbGVhbiB9PihbJ2lzUGF1c2VkJ10pXG4gIHJldHVybiAhIXJlc3VsdC5pc1BhdXNlZFxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2V0SXNQYXVzZWQodmFsdWU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgc3RvcmFnZVNldCh7IGlzUGF1c2VkOiB2YWx1ZSB9KVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGF0YShkYXRlOiBzdHJpbmcpOiBQcm9taXNlPFJhd0RhdGFbXT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBzdG9yYWdlR2V0PFJlY29yZDxzdHJpbmcsIFJhd0RhdGFbXT4+KFtkYXRlXSlcbiAgcmV0dXJuIHJlc3VsdFtkYXRlXSB8fCBbXVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZURhdGEoZGF0ZTogc3RyaW5nLCBlbnRyeTogUmF3RGF0YSk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBleGlzdGluZ0RhdGEgPSBhd2FpdCBnZXREYXRhKGRhdGUpXG4gIGV4aXN0aW5nRGF0YS5wdXNoKGVudHJ5KVxuICBhd2FpdCBzdG9yYWdlU2V0KHsgW2RhdGVdOiBleGlzdGluZ0RhdGEgfSlcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUaW1lclN0YXRlIHtcbiAgc3RhcnRUaW1lOiBudW1iZXJcbiAgY3VycmVudFRhYklkOiBudW1iZXIgfCBudWxsXG4gIGN1cnJlbnRUYWJVcmw6IHN0cmluZ1xuICBzd2l0Y2hpbmdUYWJzOiBib29sZWFuXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRUaW1lclN0YXRlKCk6IFByb21pc2U8VGltZXJTdGF0ZT4ge1xuICBjb25zdCBzdGF0ZSA9IGF3YWl0IHN0b3JhZ2VHZXQ8UGFydGlhbDxUaW1lclN0YXRlPj4oWydzdGFydFRpbWUnLCAnY3VycmVudFRhYklkJywgJ2N1cnJlbnRUYWJVcmwnLCAnc3dpdGNoaW5nVGFicyddKVxuICByZXR1cm4ge1xuICAgIHN0YXJ0VGltZTogc3RhdGUuc3RhcnRUaW1lID8/IDAsXG4gICAgY3VycmVudFRhYklkOiBzdGF0ZS5jdXJyZW50VGFiSWQgPz8gbnVsbCxcbiAgICBjdXJyZW50VGFiVXJsOiBzdGF0ZS5jdXJyZW50VGFiVXJsID8/ICcnLFxuICAgIHN3aXRjaGluZ1RhYnM6IHN0YXRlLnN3aXRjaGluZ1RhYnMgPz8gZmFsc2UsXG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldFRpbWVyU3RhdGUoc3RhdGU6IFBhcnRpYWw8VGltZXJTdGF0ZT4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgc3RvcmFnZVNldChzdGF0ZSlcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc2V0VGltZXJTdGF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgc2V0VGltZXJTdGF0ZSh7IHN0YXJ0VGltZTogMCwgY3VycmVudFRhYklkOiBudWxsLCBjdXJyZW50VGFiVXJsOiAnJywgc3dpdGNoaW5nVGFiczogZmFsc2UgfSlcbn1cbiIsImltcG9ydCB7IHRvTG9jYWxJU09EYXRlIH0gZnJvbSAnLi4vdXRpbHMvZGF0ZSdcbmltcG9ydCB7XG4gIGdldElzUGF1c2VkLFxuICBnZXRUaW1lclN0YXRlLFxuICByZXNldFRpbWVyU3RhdGUsXG4gIHNhdmVEYXRhLFxuICBzZXRJc1BhdXNlZCxcbiAgc2V0VGltZXJTdGF0ZSxcbiAgc3RvcmFnZUdldCxcbn0gZnJvbSAnLi4vdXRpbHMvc3RhdGUnXG5pbXBvcnQgeyBSYXdEYXRhIH0gZnJvbSAnLi4vdXRpbHMvdHlwZXMnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoKCkgPT4ge1xuICBjb25zdCBhZGRvblBhZ2VVUkwgPSBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKCcvbWFpbi5odG1sJylcblxuICBhc3luYyBmdW5jdGlvbiBzdGFydFRpbWVyKHRhYklkOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoYXdhaXQgZ2V0SXNQYXVzZWQoKSkgcmV0dXJuXG5cbiAgICBhd2FpdCBzZXRUaW1lclN0YXRlKHsgY3VycmVudFRhYklkOiB0YWJJZCB9KVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHRhYiA9IGF3YWl0IGJyb3dzZXIudGFicy5nZXQodGFiSWQpXG4gICAgICBpZiAoIXRhYi51cmwpIHJldHVyblxuICAgICAgYXdhaXQgc2V0VGltZXJTdGF0ZSh7IGN1cnJlbnRUYWJVcmw6IHRhYi51cmwsIHN0YXJ0VGltZTogRGF0ZS5ub3coKSB9KVxuICAgICAgY29uc29sZS5sb2coYFtMb2ddIFN0YXJ0ZWQgdHJhY2tpbmc6ICR7dGFiLnVybH1gKVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gZ2V0IHRhYjonLCBlcnJvcilcbiAgICB9XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBzdG9wVGltZXIoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc3RhdGUgPSBhd2FpdCBnZXRUaW1lclN0YXRlKClcbiAgICBpZiAoIXN0YXRlLmN1cnJlbnRUYWJJZCB8fCAhc3RhdGUuY3VycmVudFRhYlVybCB8fCAhc3RhdGUuc3RhcnRUaW1lIHx8IChhd2FpdCBnZXRJc1BhdXNlZCgpKSkge1xuICAgICAgYXdhaXQgcmVzZXRUaW1lclN0YXRlKClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGNvbnN0IGVuZFRpbWUgPSBEYXRlLm5vdygpXG4gICAgY29uc3QgZWxhcHNlZFNlY29uZHMgPSBNYXRoLmZsb29yKChlbmRUaW1lIC0gc3RhdGUuc3RhcnRUaW1lKSAvIDEwMDApXG4gICAgY29uc3Qgd2Vic2l0ZSA9IHN0YXRlLmN1cnJlbnRUYWJVcmxcblxuICAgIGlmIChlbGFwc2VkU2Vjb25kcyA8PSAwIHx8IHdlYnNpdGUuc3RhcnRzV2l0aChhZGRvblBhZ2VVUkwpKSB7XG4gICAgICBhd2FpdCByZXNldFRpbWVyU3RhdGUoKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYFtMb2ddIFN0b3BwZWQgdHJhY2tpbmcgJHt3ZWJzaXRlfSBhZnRlciAke2VsYXBzZWRTZWNvbmRzfXNgKVxuXG4gICAgY29uc3QgbmV3RW50cnk6IFJhd0RhdGEgPSB7XG4gICAgICB3ZWJzaXRlLFxuICAgICAgdGltZTogeyBzdGFydDogc3RhdGUuc3RhcnRUaW1lLCBlbmQ6IGVuZFRpbWUgfSxcbiAgICB9XG5cbiAgICBhd2FpdCBzYXZlRGF0YSh0b0xvY2FsSVNPRGF0ZShuZXcgRGF0ZSgpKSwgbmV3RW50cnkpXG4gICAgYXdhaXQgc2VuZEFsbFN0b3JlZERhdGEoKVxuICAgIGF3YWl0IHJlc2V0VGltZXJTdGF0ZSgpXG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBzZW5kQWxsU3RvcmVkRGF0YSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBhbGxEYXRhID0gYXdhaXQgc3RvcmFnZUdldDxSZWNvcmQ8c3RyaW5nLCBSYXdEYXRhW10+PihudWxsKVxuICAgIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgUmF3RGF0YVtdPiA9IHt9XG5cbiAgICBmb3IgKGNvbnN0IFtkYXRlLCBlbnRyaWVzXSBvZiBPYmplY3QuZW50cmllcyhhbGxEYXRhKSkge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGVudHJpZXMpKSBjb250aW51ZVxuXG4gICAgICBjb25zdCB2YWxpZEVudHJpZXMgPSBlbnRyaWVzLmZpbHRlcigoZW50cnkpID0+IHtcbiAgICAgICAgaWYgKCFlbnRyeS53ZWJzaXRlIHx8IGVudHJ5LndlYnNpdGUuc3RhcnRzV2l0aChhZGRvblBhZ2VVUkwpKSByZXR1cm4gZmFsc2VcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBlbnRyeS50aW1lICE9PSAnbnVtYmVyJyA/IGVudHJ5LnRpbWUuZW5kIC0gZW50cnkudGltZS5zdGFydCA+IDAgOiBlbnRyeS50aW1lID4gMFxuICAgICAgfSlcblxuICAgICAgaWYgKHZhbGlkRW50cmllcy5sZW5ndGggPiAwKSByZXN1bHRbZGF0ZV0gPSB2YWxpZEVudHJpZXNcbiAgICB9XG5cbiAgICBicm93c2VyLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBhY3Rpb246ICdzZW5kRGF0YScsIGRhdGE6IHJlc3VsdCB9KS5jYXRjaCgoKSA9PiB7fSlcbiAgfVxuXG4gIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIF9zZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGlmIChtZXNzYWdlLmFjdGlvbiA9PT0gJ3NldFBhdXNlJykge1xuICAgICAgc2V0SXNQYXVzZWQoISFtZXNzYWdlLnZhbHVlKS50aGVuKCgpID0+IHNlbmRSZXNwb25zZSh7IGlzUGF1c2VkOiAhIW1lc3NhZ2UudmFsdWUgfSkpXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICBpZiAobWVzc2FnZS5hY3Rpb24gPT09ICdnZXRQYXVzZScpIHtcbiAgICAgIGdldElzUGF1c2VkKCkudGhlbigocGF1c2VkKSA9PiBzZW5kUmVzcG9uc2UoeyBpc1BhdXNlZDogcGF1c2VkIH0pKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgaWYgKG1lc3NhZ2UuYWN0aW9uID09PSAncmVxdWVzdEFsbERhdGEnKSB7XG4gICAgICBzZW5kQWxsU3RvcmVkRGF0YSgpXG4gICAgfVxuICB9KVxuXG4gIGxldCB0YWJTd2l0Y2hUaW1lb3V0OiBhbnkgPSBudWxsXG4gIGFzeW5jIGZ1bmN0aW9uIHNhZmVTd2l0Y2godGFiSWQ6IG51bWJlcikge1xuICAgIGlmICh0YWJTd2l0Y2hUaW1lb3V0KSBjbGVhclRpbWVvdXQodGFiU3dpdGNoVGltZW91dClcbiAgICB0YWJTd2l0Y2hUaW1lb3V0ID0gc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBzdGF0ZSA9IGF3YWl0IGdldFRpbWVyU3RhdGUoKVxuICAgICAgaWYgKHN0YXRlLnN3aXRjaGluZ1RhYnMpIHJldHVyblxuICAgICAgYXdhaXQgc2V0VGltZXJTdGF0ZSh7IHN3aXRjaGluZ1RhYnM6IHRydWUgfSlcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHN0b3BUaW1lcigpXG4gICAgICAgIGF3YWl0IHN0YXJ0VGltZXIodGFiSWQpXG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBhd2FpdCBzZXRUaW1lclN0YXRlKHsgc3dpdGNoaW5nVGFiczogZmFsc2UgfSlcbiAgICAgIH1cbiAgICB9LCAxNTApXG4gIH1cblxuICBicm93c2VyLnRhYnMub25BY3RpdmF0ZWQuYWRkTGlzdGVuZXIoKGFjdGl2ZUluZm8pID0+IHNhZmVTd2l0Y2goYWN0aXZlSW5mby50YWJJZCkpXG4gIGJyb3dzZXIudGFicy5vblVwZGF0ZWQuYWRkTGlzdGVuZXIoKHRhYklkLCBjaGFuZ2VJbmZvLCB0YWIpID0+IHtcbiAgICBnZXRUaW1lclN0YXRlKCkudGhlbigoc3RhdGUpID0+IHtcbiAgICAgIGlmICh0YWJJZCA9PT0gc3RhdGUuY3VycmVudFRhYklkICYmIGNoYW5nZUluZm8uc3RhdHVzID09PSAnY29tcGxldGUnICYmIHRhYi51cmwpIHNhZmVTd2l0Y2godGFiSWQpXG4gICAgfSlcbiAgfSlcblxuICBicm93c2VyLndpbmRvd3Mub25Gb2N1c0NoYW5nZWQuYWRkTGlzdGVuZXIoYXN5bmMgKHdpbmRvd0lkKSA9PiB7XG4gICAgaWYgKHdpbmRvd0lkID09PSBicm93c2VyLndpbmRvd3MuV0lORE9XX0lEX05PTkUpIHtcbiAgICAgIGF3YWl0IHN0b3BUaW1lcigpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IFthY3RpdmVUYWJdID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHsgYWN0aXZlOiB0cnVlLCB3aW5kb3dJZCB9KVxuICAgICAgICBpZiAoYWN0aXZlVGFiPy5pZCAhPSBudWxsKSBhd2FpdCBzdGFydFRpbWVyKGFjdGl2ZVRhYi5pZClcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcmVzdW1pbmcgdGltZXIgb24gZm9jdXM6JywgZSlcbiAgICAgIH1cbiAgICB9XG4gIH0pXG5cbiAgYnJvd3Nlci53aW5kb3dzLm9uUmVtb3ZlZC5hZGRMaXN0ZW5lcigoKSA9PiBzdG9wVGltZXIoKSlcbn0pXG4iLCIvLyBzcmMvaW5kZXgudHNcbnZhciBfTWF0Y2hQYXR0ZXJuID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4pIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuID09PSBcIjxhbGxfdXJscz5cIikge1xuICAgICAgdGhpcy5pc0FsbFVybHMgPSB0cnVlO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBbLi4uX01hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG4gICAgICBpZiAoZ3JvdXBzID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuICAgICAgY29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuICAgICAgdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcbiAgICAgIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG4gICAgICB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBwcm90b2NvbCA9PT0gXCIqXCIgPyBbXCJodHRwXCIsIFwiaHR0cHNcIl0gOiBbcHJvdG9jb2xdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBwYXRobmFtZTtcbiAgICB9XG4gIH1cbiAgaW5jbHVkZXModXJsKSB7XG4gICAgaWYgKHRoaXMuaXNBbGxVcmxzKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgdSA9IHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIgPyBuZXcgVVJMKHVybCkgOiB1cmwgaW5zdGFuY2VvZiBMb2NhdGlvbiA/IG5ldyBVUkwodXJsLmhyZWYpIDogdXJsO1xuICAgIHJldHVybiAhIXRoaXMucHJvdG9jb2xNYXRjaGVzLmZpbmQoKHByb3RvY29sKSA9PiB7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwc1wiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZmlsZVwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0ZpbGVNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGdHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJ1cm5cIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcbiAgICB9KTtcbiAgfVxuICBpc0h0dHBNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHA6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0h0dHBzTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwczpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcbiAgICBpZiAoIXRoaXMuaG9zdG5hbWVNYXRjaCB8fCAhdGhpcy5wYXRobmFtZU1hdGNoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGhvc3RuYW1lTWF0Y2hSZWdleHMgPSBbXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gpLFxuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoLnJlcGxhY2UoL15cXCpcXC4vLCBcIlwiKSlcbiAgICBdO1xuICAgIGNvbnN0IHBhdGhuYW1lTWF0Y2hSZWdleCA9IHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCk7XG4gICAgcmV0dXJuICEhaG9zdG5hbWVNYXRjaFJlZ2V4cy5maW5kKChyZWdleCkgPT4gcmVnZXgudGVzdCh1cmwuaG9zdG5hbWUpKSAmJiBwYXRobmFtZU1hdGNoUmVnZXgudGVzdCh1cmwucGF0aG5hbWUpO1xuICB9XG4gIGlzRmlsZU1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmaWxlOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc0Z0cE1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmdHA6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzVXJuTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgY29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKTtcbiAgICBjb25zdCBzdGFyc1JlcGxhY2VkID0gZXNjYXBlZC5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG4gICAgcmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG4gIH1cbiAgZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG4gIH1cbn07XG52YXIgTWF0Y2hQYXR0ZXJuID0gX01hdGNoUGF0dGVybjtcbk1hdGNoUGF0dGVybi5QUk9UT0NPTFMgPSBbXCJodHRwXCIsIFwiaHR0cHNcIiwgXCJmaWxlXCIsIFwiZnRwXCIsIFwidXJuXCJdO1xudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuLCByZWFzb24pIHtcbiAgICBzdXBlcihgSW52YWxpZCBtYXRjaCBwYXR0ZXJuIFwiJHttYXRjaFBhdHRlcm59XCI6ICR7cmVhc29ufWApO1xuICB9XG59O1xuZnVuY3Rpb24gdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKSB7XG4gIGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYEhvc3RuYW1lIGNhbm5vdCBpbmNsdWRlIGEgcG9ydGApO1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCIqXCIpICYmIGhvc3RuYW1lLmxlbmd0aCA+IDEgJiYgIWhvc3RuYW1lLnN0YXJ0c1dpdGgoXCIqLlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpIHtcbiAgcmV0dXJuO1xufVxuZXhwb3J0IHtcbiAgSW52YWxpZE1hdGNoUGF0dGVybixcbiAgTWF0Y2hQYXR0ZXJuXG59O1xuIl0sIm5hbWVzIjpbImJyb3dzZXIiLCJyZXN1bHQiXSwibWFwcGluZ3MiOiI7O0FBQ0EsV0FBUyxpQkFBaUIsS0FBSztBQUM5QixRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFPLEVBQUUsTUFBTSxJQUFHO0FBQ2hFLFdBQU87QUFBQSxFQUNSO0FDSE8sUUFBTUEsWUFBVSxXQUFXLFNBQVMsU0FBUyxLQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ2FmLFFBQU0sVUFBVTtBQ1pULFdBQVMsZUFBZSxNQUFvQjtBQUNqRCxVQUFNLFFBQVEsSUFBSSxLQUFLLEtBQUssWUFBWSxLQUFLLGtCQUFBLElBQXNCLEdBQUs7QUFD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
