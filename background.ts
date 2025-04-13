/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id
const browserAPI = isFirefox ? browser : chrome

let timerInterval: ReturnType<typeof setInterval>
let startTime = 0
let elapsedSeconds = 0
let currentTabId: number | null = null
let currentTabUrl = ''

const STORE_NAME = 'BrowsingData'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BrowsingDataDB', 1)

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('date', 'date', { unique: false })
        store.createIndex('url', 'url', { unique: false })
      }
    }

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result
      resolve(db)
    }

    request.onerror = () => reject(request.error)
  })
}

interface BrowsingDataEntry {
  id?: number
  date: string
  url: string
  time: number
}

async function getData(date: string): Promise<BrowsingDataEntry[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('date')
    const request = index.getAll(date)

    request.onsuccess = () => resolve(request.result as BrowsingDataEntry[])
    request.onerror = () => reject(request.error)
  })
}

async function saveData(data: BrowsingDataEntry): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(data)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
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

async function startTimer(tabId: number): Promise<void> {
  clearInterval(timerInterval)
  calculateElapsedTime()

  currentTabId = tabId

  try {
    const tab = await browserAPI.tabs.get(tabId)
    currentTabUrl = getDomain(tab.url || '') || ''
    console.log(`Started timer on: ${currentTabUrl}`)
  } catch (error) {
    console.error('Failed to get tab:', error)
    return
  }

  startTime = Date.now()
  timerInterval = setInterval(calculateElapsedTime, 1000)
}

async function stopTimer(): Promise<void> {
  if (!currentTabId || !currentTabUrl) return
  calculateElapsedTime()

  const today = getTodayDate()
  console.log(`URL: ${currentTabUrl}, Total Time: ${elapsedSeconds} seconds`)

  const newData: BrowsingDataEntry = { date: today, url: currentTabUrl, time: elapsedSeconds }
  await saveData(newData)

  const formattedData = await getData(today)
  const result: Record<string, { website: string; time: number }[]> = {}

  formattedData.forEach((entry) => {
    const { date, url, time } = entry
    if (!result[date]) result[date] = []
    result[date].push({ website: url, time })
  })

  ;(browserAPI as typeof browser).runtime.sendMessage({
    action: 'sendData',
    data: result,
  })
  

  clearInterval(timerInterval)
  elapsedSeconds = 0
  startTime = 0
  currentTabId = null
  currentTabUrl = ''
}

// Listeners
browserAPI.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
  stopTimer()
  startTimer(activeInfo.tabId)
})

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.status === 'complete') {
    console.log(`Tab updated: ${tab.url}`)
    stopTimer()
    startTimer(tabId)
  }
})

browserAPI.windows.onFocusChanged.addListener((windowId: number) => {
  if (windowId === browserAPI.windows.WINDOW_ID_NONE) {
    stopTimer()
  }
})
