/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

type BrowserAPI = typeof browser | typeof chrome
const isFirefox = typeof browser !== 'undefined' && browser.runtime?.id
export const browserAPI: BrowserAPI = isFirefox ? browser : chrome

let isPaused = false

browserAPI.storage.local.get(['isPaused'], (result) => {
  isPaused = !!result.isPaused
})

browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'setPause') {
    isPaused = message.value
    browserAPI.storage.local.set({ isPaused })
    sendResponse({ isPaused })
    return true
  }
  if (message.action === 'getPause') {
    sendResponse({ isPaused })
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
  time: number
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
  if (isPaused) return
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

const unwantedPrefixes = ['moz-extension://', 'about:', 'chrome://', 'chrome-extension://']

async function stopTimer(): Promise<void> {
  if (!currentTabId || !currentTabUrl || !startTime || isPaused) return

  const endTime = Date.now()
  const elapsedSeconds = Math.floor((endTime - startTime) / 1000)

  const url = currentTabUrl

  if (elapsedSeconds <= 0 || !url || unwantedPrefixes.some((prefix) => url.startsWith(prefix))) {
    console.log(`Ignoring tracking for invalid URL or time: ${url} (${elapsedSeconds}s)`)
    resetTimerState()
    return
  }

  console.log(`Stopped tracking ${url} after ${elapsedSeconds}s`)

  const newData: BrowsingDataEntry = { date: today, url, time: elapsedSeconds }
  await saveData(newData)

  await sendAllStoredData()

  resetTimerState()
}

async function sendAllStoredData(): Promise<void> {
  browserAPI.storage.local.get(null, (allData) => {
    const result: Record<string, { website: string; time: number }[]> = {}

    for (const [date, entries] of Object.entries(allData)) {
      if (!Array.isArray(entries)) continue

      const filtered = entries.filter((entry: BrowsingDataEntry) => entry.time > 0 && entry.url && !unwantedPrefixes.some((prefix) => entry.url.startsWith(prefix)))

      if (filtered.length > 0) {
        result[date] = filtered.map(({ url, time }) => ({ website: url, time }))
      }
    }

    ;(browserAPI as typeof browser).runtime.sendMessage({
      action: 'sendData',
      data: result,
    })
  })
}

browserAPI.runtime.onMessage.addListener((message) => {
  if (message.action !== 'requestAllData') return
  sendAllStoredData()
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
  if (tabId === currentTabId && changeInfo.status === 'complete' && tab.url) {
    if (tab.url) {
      safeSwitch(tabId)
    }
  }
})

browserAPI.windows.onFocusChanged.addListener((windowId: number) => {
  if (windowId === browserAPI.windows.WINDOW_ID_NONE) {
    stopTimer()
  }
})
