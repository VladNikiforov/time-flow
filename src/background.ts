/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id
const browserAPI = isFirefox ? browser : chrome

let timerInterval: ReturnType<typeof setInterval>
let startTime = 0
let elapsedSeconds = 0
let currentTabId: number | null = null
let currentTabUrl = ''
let switchingTabs = false

interface BrowsingDataEntry {
  date: string
  url: string
  time: number
}

function getTodayDate(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

function calculateElapsedTime(): void {
  if (startTime) {
    const now = Date.now()
    elapsedSeconds += Math.floor((now - startTime) / 1000)
    startTime = now
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).origin
  } catch (e) {
    console.error('Invalid URL:', url)
    return ''
  }
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
  clearInterval(timerInterval)
  calculateElapsedTime()

  currentTabId = tabId

  try {
    const tab = await browserAPI.tabs.get(tabId)
    const domain = getDomain(tab.url || '')
    if (!domain.startsWith('http')) return
    currentTabUrl = domain
    console.log(`Started timer on: ${currentTabUrl}`)
  } catch (error) {
    console.error('Failed to get tab:', error)
    return
  }

  startTime = Date.now()
  timerInterval = setInterval(calculateElapsedTime, 1000)
}

const unwantedPrefixes = ['moz-extension://', 'about:', 'chrome://', 'chrome-extension://']

async function stopTimer(): Promise<void> {
  if (!currentTabId || !currentTabUrl) return
  calculateElapsedTime()

  const today = getTodayDate()
  const time = elapsedSeconds
  const url = currentTabUrl

  if (time <= 0 || !url || unwantedPrefixes.some((prefix) => url.startsWith(prefix))) {
    console.log(`Ignoring timer for invalid URL or time: ${url} (${time}s)`)
    resetTimerState()
    return
  }

  console.log(`Stopping timer for ${url} with ${time}s`)

  const newData: BrowsingDataEntry = { date: today, url, time }
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

function resetTimerState() {
  clearInterval(timerInterval)
  elapsedSeconds = 0
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
    const newUrl = getDomain(tab.url)
    if (newUrl && newUrl !== currentTabUrl && newUrl.startsWith('http')) {
      safeSwitch(tabId)
    }
  }
})

browserAPI.windows.onFocusChanged.addListener((windowId: number) => {
  if (windowId === browserAPI.windows.WINDOW_ID_NONE) {
    stopTimer()
  }
})
