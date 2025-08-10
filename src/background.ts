/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

type BrowserAPI = typeof browser | typeof chrome
const isFirefox = typeof browser !== 'undefined' && browser.runtime?.id
export const browserAPI: BrowserAPI = isFirefox ? browser : chrome

export const addonPageURL = browserAPI.runtime.getURL('public/index.html')

async function getIsPaused(): Promise<boolean> {
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['isPaused'], (result) => {
      resolve(!!result.isPaused)
    })
  })
}

async function setIsPaused(value: boolean): Promise<void> {
  return new Promise((resolve) => {
    browserAPI.storage.local.set({ isPaused: value }, () => resolve())
  })
}

browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'setPause') {
    setIsPaused(message.value).then(() => {
      sendResponse({ isPaused: message.value })
    })
    return true
  } else if (message.action === 'getPause') {
    getIsPaused().then((paused) => {
      sendResponse({ isPaused: paused })
    })
    return true
  }
})

export function toLocalISODate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export const today = toLocalISODate(new Date())

let startTime = 0
let currentTabId: number | null = null
let currentTabUrl = ''
let switchingTabs = false

interface BrowsingDataEntry {
  date: string
  url: string
  time: { start: number; end: number } | number
}

async function getData(date: string): Promise<BrowsingDataEntry[]> {
  return new Promise((resolve) => {
    browserAPI.storage.local.get([date], (result) => {
      resolve(result[date] || [])
    })
  })
}

async function saveData(data: BrowsingDataEntry): Promise<void> {
  const existingData = await getData(data.date)
  existingData.push(data)

  return new Promise((resolve) => {
    browserAPI.storage.local.set({ [data.date]: existingData }, () => resolve())
  })
}

async function startTimer(tabId: number): Promise<void> {
  if (await getIsPaused()) return
  currentTabId = tabId

  try {
    const tab = await browserAPI.tabs.get(tabId)
    if (!tab.url) return
    currentTabUrl = tab.url
    console.log(`Started tracking: ${currentTabUrl}`)
  } catch (error) {
    console.error('Failed to get tab:', error)
    return
  }

  startTime = Date.now()
}

async function stopTimer(): Promise<void> {
  if (!currentTabId || !currentTabUrl || !startTime) return
  if (await getIsPaused()) return

  const endTime = Date.now()
  const elapsedSeconds = Math.floor((endTime - startTime) / 1000)

  const url = currentTabUrl

  if (elapsedSeconds <= 0 || !url || url.startsWith(addonPageURL)) {
    console.log(`Ignoring tracking for invalid URL or time: ${url} (${elapsedSeconds}s)`)
    resetTimerState()
    return
  }

  console.log(`Stopped tracking ${url} after ${elapsedSeconds}s`)

  const newData: BrowsingDataEntry = { date: today, url, time: { start: startTime, end: endTime} }
  await saveData(newData)

  await sendAllStoredData()

  resetTimerState()
}

async function sendAllStoredData(): Promise<void> {
  browserAPI.storage.local.get(null, (allData) => {
    const result: Record<string, { url: string; time: number }[]> = {}

    for (const [date, entries] of Object.entries(allData)) {
      if (!Array.isArray(entries)) continue

      const invlidFilter = entries.filter((entry) => {
        if (!entry.url || entry.url.startsWith(addonPageURL)) return false

        return typeof entry.time !== 'number' ? entry.time.end - entry.time.start > 0 : entry.time > 0
      })

      if (invlidFilter.length > 0) result[date] = invlidFilter
    }

    ;(browserAPI as typeof browser).runtime.sendMessage({
      action: 'sendData',
      data: result,
    })
  })
}

browserAPI.runtime.onMessage.addListener((message) => {
  if (message.action === 'requestAllData') sendAllStoredData()
})

function resetTimerState() {
  startTime = 0
  currentTabId = null
  currentTabUrl = ''
}

async function safeSwitch(tabId: number) {
  if (switchingTabs) return
  switchingTabs = true

  await stopTimer()
  await startTimer(tabId)

  switchingTabs = false
}

browserAPI.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
  safeSwitch(activeInfo.tabId)
})

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.status === 'complete' && tab.url) safeSwitch(tabId)
})

browserAPI.windows.onFocusChanged.addListener((windowId: number) => {
  if (windowId === browserAPI.windows.WINDOW_ID_NONE) stopTimer()
})
