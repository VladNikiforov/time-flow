var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  const definition = defineBackground(() => {
    const addonPageURL = browser.runtime.getURL("/main.html");
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
    function toLocalISODate(date) {
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 6e4);
      return local.toISOString().slice(0, 10);
    }
    const today = toLocalISODate(/* @__PURE__ */ new Date());
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
    async function startTimer(tabId) {
      if (await getIsPaused()) return;
      await setTimerState({ currentTabId: tabId });
      try {
        const tab = await browser.tabs.get(tabId);
        if (!tab.url) return;
        await setTimerState({ currentTabUrl: tab.url });
        console.log(`Started tracking: ${tab.url}`);
      } catch (error) {
        console.error("Failed to get tab:", error);
        return;
      }
      await setTimerState({ startTime: Date.now() });
    }
    async function stopTimer() {
      const state = await getTimerState();
      if (!state.currentTabId || !state.currentTabUrl || !state.startTime) return;
      if (await getIsPaused()) return;
      const endTime = Date.now();
      const elapsedSeconds = Math.floor((endTime - state.startTime) / 1e3);
      const website = state.currentTabUrl;
      if (elapsedSeconds <= 0 || website.startsWith(addonPageURL)) {
        console.log(`Ignoring tracking for invalid URL or time: ${website} (${elapsedSeconds}s)`);
        await resetTimerState();
        return;
      }
      console.log(`Stopped tracking ${website} after ${elapsedSeconds}s`);
      const newEntry = {
        website,
        time: { start: state.startTime, end: endTime }
      };
      await saveData(today, newEntry);
      await sendAllStoredData();
      await resetTimerState();
    }
    async function sendAllStoredData() {
      const allData = await storageGet(null);
      const result2 = {};
      for (const [date, entries] of Object.entries(allData)) {
        if (!Array.isArray(entries)) continue;
        const validEntries = entries.filter((entry) => {
          if (!("website" in entry) || !entry.website || entry.website.startsWith(addonPageURL)) return false;
          return typeof entry.time !== "number" ? entry.time.end - entry.time.start > 0 : entry.time > 0;
        });
        if (validEntries.length > 0) result2[date] = validEntries;
      }
      browser.runtime.sendMessage({
        action: "sendData",
        data: result2
      }).catch(() => {
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
    browser.tabs.onActivated.addListener(async (activeInfo) => {
      safeSwitch(activeInfo.tabId);
    });
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      const state = await getTimerState();
      if (tabId === state.currentTabId && changeInfo.status === "complete" && tab.url) safeSwitch(tabId);
    });
    browser.windows.onFocusChanged.addListener(async (windowId) => {
      await getTimerState();
      if (windowId === browser.windows.WINDOW_ID_NONE) {
        console.log("Window unfocused \u2014 stopping timer");
        await stopTimer();
        return;
      }
      try {
        const [activeTab] = await browser.tabs.query({ active: true, windowId });
        if (activeTab && activeTab.id != null) {
          console.log("Window focused again \u2014 resuming tracking");
          await startTimer(activeTab.id);
        }
      } catch (e) {
        console.error("Error resuming timer on focus:", e);
      }
    });
    browser.windows.onRemoved.addListener(async (windowId) => {
      console.log(`Window ${windowId} closed \u2014 stopping timer`);
      await stopTimer();
    });
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
      if (true) {
        ws2.addEventListener("open", () => ws2.sendCustom("wxt:background-initialized"));
        keepServiceWorkerAlive();
      }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI1X0B0eXBlcytub2RlQDI0LjEyLjJfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMi4wX3JvbGx1cEA0LjYwLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40MC9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI1X0B0eXBlcytub2RlQDI0LjEyLjJfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMi4wX3JvbGx1cEA0LjYwLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vZW50cnlwb2ludHMvYmFja2dyb3VuZC50cyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad2ViZXh0LWNvcmUrbWF0Y2gtcGF0dGVybnNAMS4wLjMvbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy91dGlscy9kZWZpbmUtYmFja2dyb3VuZC50c1xuZnVuY3Rpb24gZGVmaW5lQmFja2dyb3VuZChhcmcpIHtcblx0aWYgKGFyZyA9PSBudWxsIHx8IHR5cGVvZiBhcmcgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHsgbWFpbjogYXJnIH07XG5cdHJldHVybiBhcmc7XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGRlZmluZUJhY2tncm91bmQgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgYnJvd3NlciQxIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvYnJvd3Nlci50c1xuLyoqXG4qIENvbnRhaW5zIHRoZSBgYnJvd3NlcmAgZXhwb3J0IHdoaWNoIHlvdSBzaG91bGQgdXNlIHRvIGFjY2VzcyB0aGUgZXh0ZW5zaW9uXG4qIEFQSXMgaW4geW91ciBwcm9qZWN0OlxuKlxuKiBgYGB0c1xuKiBpbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuKlxuKiBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKCkgPT4ge1xuKiAgIC8vIC4uLlxuKiB9KTtcbiogYGBgXG4qXG4qIEBtb2R1bGUgd3h0L2Jyb3dzZXJcbiovXG5jb25zdCBicm93c2VyID0gYnJvd3NlciQxO1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBicm93c2VyIH07XG4iLCJleHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgLy8gVGltZUZsb3cgLSBicm93c2VyIGV4dGVuc2lvbjsgKGMpIDIwMjQgVmxhZE5pa2lmb3JvdjsgR1BMdjMsIHNlZSBMSUNFTlNFIGZpbGVcblxuICBjb25zdCBhZGRvblBhZ2VVUkwgPSBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKCcvbWFpbi5odG1sJyk7XG5cbiAgLy8gU3RvcmFnZSBIZWxwZXJzXG5cbiAgdHlwZSBTdG9yYWdlSXRlbXMgPSBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHN0b3JhZ2VHZXQ8VCBleHRlbmRzIFN0b3JhZ2VJdGVtcz4oa2V5cz86IHN0cmluZ1tdIHwgbnVsbCk6IFByb21pc2U8VD4ge1xuICAgIHJldHVybiAoYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldChrZXlzKSkgYXMgYW55O1xuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gc3RvcmFnZVNldChpdGVtczogU3RvcmFnZUl0ZW1zKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldChpdGVtcyk7XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBnZXRJc1BhdXNlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzdG9yYWdlR2V0PHsgaXNQYXVzZWQ/OiBib29sZWFuIH0+KFsnaXNQYXVzZWQnXSk7XG4gICAgcmV0dXJuICEhcmVzdWx0LmlzUGF1c2VkO1xuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gc2V0SXNQYXVzZWQodmFsdWU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBzdG9yYWdlU2V0KHsgaXNQYXVzZWQ6IHZhbHVlIH0pO1xuICB9XG5cbiAgLy8gRGF0ZSBIZWxwZXJzXG5cbiAgZnVuY3Rpb24gdG9Mb2NhbElTT0RhdGUoZGF0ZTogRGF0ZSk6IHN0cmluZyB7XG4gICAgY29uc3QgbG9jYWwgPSBuZXcgRGF0ZShkYXRlLmdldFRpbWUoKSAtIGRhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKSAqIDYwMDAwKTtcbiAgICByZXR1cm4gbG9jYWwudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCk7XG4gIH1cblxuICBjb25zdCB0b2RheSA9IHRvTG9jYWxJU09EYXRlKG5ldyBEYXRlKCkpO1xuXG4gIC8vIFN0YXRlIEhlbHBlcnNcblxuICB0eXBlIFJhd0RhdGEgPSB7XG4gICAgd2Vic2l0ZTogc3RyaW5nO1xuICAgIHRpbWU6IHsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXIgfSB8IG51bWJlcjtcbiAgfTtcblxuICBhc3luYyBmdW5jdGlvbiBnZXREYXRhKGRhdGU6IHN0cmluZyk6IFByb21pc2U8UmF3RGF0YVtdPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgc3RvcmFnZUdldDxSZWNvcmQ8c3RyaW5nLCBSYXdEYXRhW10+PihbZGF0ZV0pO1xuICAgIHJldHVybiByZXN1bHRbZGF0ZV0gfHwgW107XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBzYXZlRGF0YShkYXRlOiBzdHJpbmcsIGVudHJ5OiBSYXdEYXRhKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZXhpc3RpbmdEYXRhID0gYXdhaXQgZ2V0RGF0YShkYXRlKTtcbiAgICBleGlzdGluZ0RhdGEucHVzaChlbnRyeSk7XG4gICAgYXdhaXQgc3RvcmFnZVNldCh7IFtkYXRlXTogZXhpc3RpbmdEYXRhIH0pO1xuICB9XG5cbiAgaW50ZXJmYWNlIFRpbWVyU3RhdGUge1xuICAgIHN0YXJ0VGltZTogbnVtYmVyO1xuICAgIGN1cnJlbnRUYWJJZDogbnVtYmVyIHwgbnVsbDtcbiAgICBjdXJyZW50VGFiVXJsOiBzdHJpbmc7XG4gICAgc3dpdGNoaW5nVGFiczogYm9vbGVhbjtcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGdldFRpbWVyU3RhdGUoKTogUHJvbWlzZTxUaW1lclN0YXRlPiB7XG4gICAgY29uc3Qgc3RhdGUgPSBhd2FpdCBzdG9yYWdlR2V0PFBhcnRpYWw8VGltZXJTdGF0ZT4+KFsnc3RhcnRUaW1lJywgJ2N1cnJlbnRUYWJJZCcsICdjdXJyZW50VGFiVXJsJywgJ3N3aXRjaGluZ1RhYnMnXSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXJ0VGltZTogc3RhdGUuc3RhcnRUaW1lID8/IDAsXG4gICAgICBjdXJyZW50VGFiSWQ6IHN0YXRlLmN1cnJlbnRUYWJJZCA/PyBudWxsLFxuICAgICAgY3VycmVudFRhYlVybDogc3RhdGUuY3VycmVudFRhYlVybCA/PyAnJyxcbiAgICAgIHN3aXRjaGluZ1RhYnM6IHN0YXRlLnN3aXRjaGluZ1RhYnMgPz8gZmFsc2UsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHNldFRpbWVyU3RhdGUoc3RhdGU6IFBhcnRpYWw8VGltZXJTdGF0ZT4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBzdG9yYWdlU2V0KHN0YXRlKTtcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHJlc2V0VGltZXJTdGF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBzZXRUaW1lclN0YXRlKHsgc3RhcnRUaW1lOiAwLCBjdXJyZW50VGFiSWQ6IG51bGwsIGN1cnJlbnRUYWJVcmw6ICcnLCBzd2l0Y2hpbmdUYWJzOiBmYWxzZSB9KTtcbiAgfVxuXG4gIC8vIFRpbWVyXG5cbiAgYXN5bmMgZnVuY3Rpb24gc3RhcnRUaW1lcih0YWJJZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKGF3YWl0IGdldElzUGF1c2VkKCkpIHJldHVybjtcblxuICAgIGF3YWl0IHNldFRpbWVyU3RhdGUoeyBjdXJyZW50VGFiSWQ6IHRhYklkIH0pO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHRhYiA9IGF3YWl0IGJyb3dzZXIudGFicy5nZXQodGFiSWQpO1xuICAgICAgaWYgKCF0YWIudXJsKSByZXR1cm47XG4gICAgICBhd2FpdCBzZXRUaW1lclN0YXRlKHsgY3VycmVudFRhYlVybDogdGFiLnVybCB9KTtcbiAgICAgIGNvbnNvbGUubG9nKGBTdGFydGVkIHRyYWNraW5nOiAke3RhYi51cmx9YCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgdGFiOicsIGVycm9yKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhd2FpdCBzZXRUaW1lclN0YXRlKHsgc3RhcnRUaW1lOiBEYXRlLm5vdygpIH0pO1xuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gc3RvcFRpbWVyKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgZ2V0VGltZXJTdGF0ZSgpO1xuICAgIGlmICghc3RhdGUuY3VycmVudFRhYklkIHx8ICFzdGF0ZS5jdXJyZW50VGFiVXJsIHx8ICFzdGF0ZS5zdGFydFRpbWUpIHJldHVybjtcbiAgICBpZiAoYXdhaXQgZ2V0SXNQYXVzZWQoKSkgcmV0dXJuO1xuXG4gICAgY29uc3QgZW5kVGltZSA9IERhdGUubm93KCk7XG4gICAgY29uc3QgZWxhcHNlZFNlY29uZHMgPSBNYXRoLmZsb29yKChlbmRUaW1lIC0gc3RhdGUuc3RhcnRUaW1lKSAvIDEwMDApO1xuICAgIGNvbnN0IHdlYnNpdGUgPSBzdGF0ZS5jdXJyZW50VGFiVXJsO1xuXG4gICAgaWYgKGVsYXBzZWRTZWNvbmRzIDw9IDAgfHwgd2Vic2l0ZS5zdGFydHNXaXRoKGFkZG9uUGFnZVVSTCkpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBJZ25vcmluZyB0cmFja2luZyBmb3IgaW52YWxpZCBVUkwgb3IgdGltZTogJHt3ZWJzaXRlfSAoJHtlbGFwc2VkU2Vjb25kc31zKWApO1xuICAgICAgYXdhaXQgcmVzZXRUaW1lclN0YXRlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coYFN0b3BwZWQgdHJhY2tpbmcgJHt3ZWJzaXRlfSBhZnRlciAke2VsYXBzZWRTZWNvbmRzfXNgKTtcblxuICAgIGNvbnN0IG5ld0VudHJ5OiBSYXdEYXRhID0ge1xuICAgICAgd2Vic2l0ZSxcbiAgICAgIHRpbWU6IHsgc3RhcnQ6IHN0YXRlLnN0YXJ0VGltZSwgZW5kOiBlbmRUaW1lIH0sXG4gICAgfTtcblxuICAgIGF3YWl0IHNhdmVEYXRhKHRvZGF5LCBuZXdFbnRyeSk7XG4gICAgYXdhaXQgc2VuZEFsbFN0b3JlZERhdGEoKTtcbiAgICBhd2FpdCByZXNldFRpbWVyU3RhdGUoKTtcbiAgfVxuXG4gIC8vIE1lc3NhZ2luZ1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHNlbmRBbGxTdG9yZWREYXRhKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGFsbERhdGEgPSBhd2FpdCBzdG9yYWdlR2V0PFJlY29yZDxzdHJpbmcsIFJhd0RhdGFbXT4+KG51bGwpO1xuICAgIGNvbnN0IHJlc3VsdDogUmVjb3JkPHN0cmluZywgUmF3RGF0YVtdPiA9IHt9O1xuXG4gICAgZm9yIChjb25zdCBbZGF0ZSwgZW50cmllc10gb2YgT2JqZWN0LmVudHJpZXMoYWxsRGF0YSkpIHtcbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShlbnRyaWVzKSkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IHZhbGlkRW50cmllcyA9IGVudHJpZXMuZmlsdGVyKChlbnRyeSkgPT4ge1xuICAgICAgICBpZiAoISgnd2Vic2l0ZScgaW4gZW50cnkpIHx8ICFlbnRyeS53ZWJzaXRlIHx8IGVudHJ5LndlYnNpdGUuc3RhcnRzV2l0aChhZGRvblBhZ2VVUkwpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiB0eXBlb2YgZW50cnkudGltZSAhPT0gJ251bWJlcicgPyBlbnRyeS50aW1lLmVuZCAtIGVudHJ5LnRpbWUuc3RhcnQgPiAwIDogZW50cnkudGltZSA+IDA7XG4gICAgICB9KTtcblxuICAgICAgaWYgKHZhbGlkRW50cmllcy5sZW5ndGggPiAwKSByZXN1bHRbZGF0ZV0gPSB2YWxpZEVudHJpZXM7XG4gICAgfVxuXG4gICAgYnJvd3Nlci5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgIGFjdGlvbjogJ3NlbmREYXRhJyxcbiAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAvLyBJZ25vcmUgZXJyb3JzIHdoZW4gbm8gb25lIGlzIGxpc3RlbmluZ1xuICAgIH0pO1xuICB9XG5cbiAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgX3NlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgaWYgKG1lc3NhZ2UuYWN0aW9uID09PSAnc2V0UGF1c2UnKSB7XG4gICAgICBzZXRJc1BhdXNlZCghIW1lc3NhZ2UudmFsdWUpLnRoZW4oKCkgPT4gc2VuZFJlc3BvbnNlKHsgaXNQYXVzZWQ6ICEhbWVzc2FnZS52YWx1ZSB9KSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKG1lc3NhZ2UuYWN0aW9uID09PSAnZ2V0UGF1c2UnKSB7XG4gICAgICBnZXRJc1BhdXNlZCgpLnRoZW4oKHBhdXNlZCkgPT4gc2VuZFJlc3BvbnNlKHsgaXNQYXVzZWQ6IHBhdXNlZCB9KSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKG1lc3NhZ2UuYWN0aW9uID09PSAncmVxdWVzdEFsbERhdGEnKSB7XG4gICAgICBzZW5kQWxsU3RvcmVkRGF0YSgpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gVGFiIFN3aXRjaGluZyAoZGVib3VuY2VkKVxuXG4gIGxldCB0YWJTd2l0Y2hUaW1lb3V0OiBhbnkgPSBudWxsO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHNhZmVTd2l0Y2godGFiSWQ6IG51bWJlcikge1xuICAgIGlmICh0YWJTd2l0Y2hUaW1lb3V0KSBjbGVhclRpbWVvdXQodGFiU3dpdGNoVGltZW91dCk7XG4gICAgdGFiU3dpdGNoVGltZW91dCA9IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3Qgc3RhdGUgPSBhd2FpdCBnZXRUaW1lclN0YXRlKCk7XG4gICAgICBpZiAoc3RhdGUuc3dpdGNoaW5nVGFicykgcmV0dXJuO1xuICAgICAgYXdhaXQgc2V0VGltZXJTdGF0ZSh7IHN3aXRjaGluZ1RhYnM6IHRydWUgfSk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBzdG9wVGltZXIoKTtcbiAgICAgICAgYXdhaXQgc3RhcnRUaW1lcih0YWJJZCk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBhd2FpdCBzZXRUaW1lclN0YXRlKHsgc3dpdGNoaW5nVGFiczogZmFsc2UgfSk7XG4gICAgICB9XG4gICAgfSwgMTUwKTtcbiAgfVxuXG4gIC8vIEV2ZW50IExpc3RlbmVyc1xuXG4gIGJyb3dzZXIudGFicy5vbkFjdGl2YXRlZC5hZGRMaXN0ZW5lcihhc3luYyAoYWN0aXZlSW5mbykgPT4ge1xuICAgIHNhZmVTd2l0Y2goYWN0aXZlSW5mby50YWJJZCk7XG4gIH0pO1xuXG4gIGJyb3dzZXIudGFicy5vblVwZGF0ZWQuYWRkTGlzdGVuZXIoYXN5bmMgKHRhYklkLCBjaGFuZ2VJbmZvLCB0YWIpID0+IHtcbiAgICBjb25zdCBzdGF0ZSA9IGF3YWl0IGdldFRpbWVyU3RhdGUoKTtcbiAgICBpZiAodGFiSWQgPT09IHN0YXRlLmN1cnJlbnRUYWJJZCAmJiBjaGFuZ2VJbmZvLnN0YXR1cyA9PT0gJ2NvbXBsZXRlJyAmJiB0YWIudXJsKSBzYWZlU3dpdGNoKHRhYklkKTtcbiAgfSk7XG5cbiAgLy8gRm9jdXMvdW5mb2N1cyBhbmQgd2luZG93IGNsb3NlXG5cbiAgYnJvd3Nlci53aW5kb3dzLm9uRm9jdXNDaGFuZ2VkLmFkZExpc3RlbmVyKGFzeW5jICh3aW5kb3dJZCkgPT4ge1xuICAgIGNvbnN0IHN0YXRlID0gYXdhaXQgZ2V0VGltZXJTdGF0ZSgpO1xuXG4gICAgaWYgKHdpbmRvd0lkID09PSBicm93c2VyLndpbmRvd3MuV0lORE9XX0lEX05PTkUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdXaW5kb3cgdW5mb2N1c2VkIOKAlCBzdG9wcGluZyB0aW1lcicpO1xuICAgICAgYXdhaXQgc3RvcFRpbWVyKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IFthY3RpdmVUYWJdID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHsgYWN0aXZlOiB0cnVlLCB3aW5kb3dJZCB9KTtcbiAgICAgIGlmIChhY3RpdmVUYWIgJiYgYWN0aXZlVGFiLmlkICE9IG51bGwpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1dpbmRvdyBmb2N1c2VkIGFnYWluIOKAlCByZXN1bWluZyB0cmFja2luZycpO1xuICAgICAgICBhd2FpdCBzdGFydFRpbWVyKGFjdGl2ZVRhYi5pZCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcmVzdW1pbmcgdGltZXIgb24gZm9jdXM6JywgZSk7XG4gICAgfVxuICB9KTtcblxuICBicm93c2VyLndpbmRvd3Mub25SZW1vdmVkLmFkZExpc3RlbmVyKGFzeW5jICh3aW5kb3dJZCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKGBXaW5kb3cgJHt3aW5kb3dJZH0gY2xvc2VkIOKAlCBzdG9wcGluZyB0aW1lcmApO1xuICAgIGF3YWl0IHN0b3BUaW1lcigpO1xuICB9KTtcbn0pO1xuIiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwicmVzdWx0Il0sIm1hcHBpbmdzIjoiOztBQUNBLFdBQVMsaUJBQWlCLEtBQUs7QUFDOUIsUUFBSSxPQUFPLFFBQVEsT0FBTyxRQUFRLFdBQVksUUFBTyxFQUFFLE1BQU0sSUFBRztBQUNoRSxXQUFPO0FBQUEsRUFDUjtBQ0hPLFFBQU1BLFlBQVUsV0FBVyxTQUFTLFNBQVMsS0FDaEQsV0FBVyxVQUNYLFdBQVc7QUNhZixRQUFNLFVBQVU7QUNoQmhCLFFBQUEsYUFBQSxpQkFBQSxNQUFBO0FBR0UsVUFBQSxlQUFBLFFBQUEsUUFBQSxPQUFBLFlBQUE7QUFNQSxtQkFBQSxXQUFBLE1BQUE7QUFDRSxhQUFBLE1BQUEsUUFBQSxRQUFBLE1BQUEsSUFBQSxJQUFBO0FBQUEsSUFBNEM7QUFHOUMsbUJBQUEsV0FBQSxPQUFBO0FBQ0UsWUFBQSxRQUFBLFFBQUEsTUFBQSxJQUFBLEtBQUE7QUFBQSxJQUFxQztBQUd2QyxtQkFBQSxjQUFBO0FBQ0UsWUFBQUMsVUFBQSxNQUFBLFdBQUEsQ0FBQSxVQUFBLENBQUE7QUFDQSxhQUFBLENBQUEsQ0FBQUEsUUFBQTtBQUFBLElB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
