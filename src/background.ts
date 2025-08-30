/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

type BrowserAPI = typeof browser | typeof chrome
const isFirefox = typeof browser !== 'undefined' && !!browser.runtime?.id
export const browserAPI: BrowserAPI = isFirefox ? browser : chrome

export const addonPageURL = browserAPI.runtime.getURL('public/index.html')

// Storage Helpers

type StorageItems = Record<string, any>

async function storageGet<T extends StorageItems>(keys?: string[] | null): Promise<T> {
  return (await browserAPI.storage.local.get(keys)) as any
}

async function storageSet(items: StorageItems): Promise<void> {
  await browserAPI.storage.local.set(items)
}

export async function getIsPaused(): Promise<boolean> {
  const result = await storageGet<{ isPaused?: boolean }>(['isPaused'])
  return !!result.isPaused
}

export async function setIsPaused(value: boolean): Promise<void> {
  await storageSet({ isPaused: value })
}

// Date Helpers

export function toLocalISODate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export const today = toLocalISODate(new Date())

// State Helpers

export type RawData = {
  date: string
  url: string
  time: { start: number; end: number } | number
}

async function getData(date: string): Promise<RawData[]> {
  const result = await storageGet<Record<string, RawData[]>>([date])
  return result[date] || []
}

async function saveData(data: RawData & { date: string }): Promise<void> {
  const existingData = await getData(data.date)
  existingData.push(data)
  await storageSet({ [data.date]: existingData })
}

// Service worker safe state
interface TimerState {
  startTime: number
  currentTabId: number | null
  currentTabUrl: string
  switchingTabs: boolean
}

async function getTimerState(): Promise<TimerState> {
  const state = await storageGet<Partial<TimerState>>(['startTime', 'currentTabId', 'currentTabUrl', 'switchingTabs'])
  return {
    startTime: state.startTime ?? 0,
    currentTabId: state.currentTabId ?? null,
    currentTabUrl: state.currentTabUrl ?? '',
    switchingTabs: state.switchingTabs ?? false,
  }
}

async function setTimerState(state: Partial<TimerState>): Promise<void> {
  await storageSet(state)
}

async function resetTimerState(): Promise<void> {
  await setTimerState({ startTime: 0, currentTabId: null, currentTabUrl: '', switchingTabs: false })
}

// Timer

async function startTimer(tabId: number): Promise<void> {
  if (await getIsPaused()) return

  await setTimerState({ currentTabId: tabId })

  try {
    const tab = await browserAPI.tabs.get(tabId)
    if (!tab.url) return
    await setTimerState({ currentTabUrl: tab.url })
    console.log(`Started tracking: ${tab.url}`)
  } catch (error) {
    console.error('Failed to get tab:', error)
    return
  }

  await setTimerState({ startTime: Date.now() })
}

async function stopTimer(): Promise<void> {
  const state = await getTimerState()
  if (!state.currentTabId || !state.currentTabUrl || !state.startTime) return
  if (await getIsPaused()) return

  const endTime = Date.now()
  const elapsedSeconds = Math.floor((endTime - state.startTime) / 1000)
  const url = state.currentTabUrl

  if (elapsedSeconds <= 0 || url.startsWith(addonPageURL)) {
    console.log(`Ignoring tracking for invalid URL or time: ${url} (${elapsedSeconds}s)`)
    await resetTimerState()
    return
  }

  console.log(`Stopped tracking ${url} after ${elapsedSeconds}s`)

  const newData: RawData = {
    date: today,
    url,
    time: { start: state.startTime, end: endTime },
  }

  await saveData(newData as RawData & { date: string })
  await sendAllStoredData()
  await resetTimerState()
}

// Messaging

async function sendAllStoredData(): Promise<void> {
  const allData = await storageGet<Record<string, RawData[]>>(null)
  const result: Record<string, RawData[]> = {}

  for (const [date, entries] of Object.entries(allData)) {
    if (!Array.isArray(entries)) continue

    const validEntries = entries.filter((entry) => {
      if (!('url' in entry) || !entry.url || entry.url.startsWith(addonPageURL)) return false
      return typeof entry.time !== 'number' ? entry.time.end - entry.time.start > 0 : entry.time > 0
    })

    if (validEntries.length > 0) result[date] = validEntries
  }

  ;(browserAPI as typeof browser).runtime.sendMessage({
    action: 'sendData',
    data: result,
  })
}

browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'setPause') {
    setIsPaused(!!message.value).then(() => sendResponse({ isPaused: !!message.value }))
    return true
  }
  if (message.action === 'getPause') {
    getIsPaused().then((paused) => sendResponse({ isPaused: paused }))
    return true
  }
  if (message.action === 'requestAllData') {
    sendAllStoredData()
  }
})

// Tab Switching

async function safeSwitch(tabId: number) {
  const state = await getTimerState()
  if (state.switchingTabs) return
  await setTimerState({ switchingTabs: true })

  try {
    await stopTimer()
    await startTimer(tabId)
  } finally {
    await setTimerState({ switchingTabs: false })
  }
}

// Event Listeners

browserAPI.tabs.onActivated.addListener(async (activeInfo) => {
  safeSwitch(activeInfo.tabId)
})

browserAPI.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const state = await getTimerState()
  if (tabId === state.currentTabId && changeInfo.status === 'complete' && tab.url) safeSwitch(tabId)
})

browserAPI.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === browserAPI.windows.WINDOW_ID_NONE) stopTimer()
})
