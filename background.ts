/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

let timerInterval: any,
  startTime = 0,
  elapsedSeconds = 0,
  currentTabId: any,
  currentTabUrl = ''

const STORE_NAME = 'BrowsingData'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BrowsingDataDB', 1)

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('date', 'date', { unique: false })
        store.createIndex('url', 'url', { unique: false })
      }
    }

    request.onsuccess = (event: any) => resolve(event.target.result)
    request.onerror = (event) => reject(request.error)
  })
}

async function getData(date: any) {
  const db: any = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('date')

    const request = index.getAll(date)

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

async function saveData(data: any) {
  const db: any = await openDatabase()
  return new Promise((resolve: any, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(data)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function getTodayDate() {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

function calculateElapsedTime() {
  if (startTime) {
    const now = Date.now()
    elapsedSeconds += Math.floor((now - startTime) / 1000)
    startTime = now
  }
}

function getDomain(url: any) {
  try {
    return new URL(url).origin
  } catch (e) {
    console.error('Invalid URL:', url)
    return ''
  }
}

async function startTimer(tabId: any) {
  clearInterval(timerInterval)
  calculateElapsedTime()

  currentTabId = tabId

  try {
    const tab = await browser.tabs.get(tabId)
    currentTabUrl = getDomain(tab.url) || ''
    console.log(`Started timer on: ${currentTabUrl}`)
  } catch (error) {
    console.error('Failed to get tab:', error)
    return
  }

  startTime = Date.now()
  timerInterval = setInterval(calculateElapsedTime, 1000)
}

async function stopTimer() {
  if (!currentTabId || !currentTabUrl) return
  calculateElapsedTime()

  const today = getTodayDate()
  console.log(`URL: ${currentTabUrl}, Total Time: ${elapsedSeconds} seconds`)

  const newData = { date: today, url: currentTabUrl, time: elapsedSeconds }
  await saveData(newData)

  const formattedData: any = await getData(today)
  const result: any = {}

  formattedData.forEach((entry: any) => {
    const { date, url, time } = entry
    if (!result[date]) {
      result[date] = []
    }
    result[date].push({ website: url, time })
  })

  browser.runtime.sendMessage({
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
browser.tabs.onActivated.addListener((activeInfo) => {
  stopTimer()
  startTimer(activeInfo.tabId)
})

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.status === 'complete') {
    console.log(`Tab updated: ${tab.url}`)
    stopTimer()
    startTimer(tabId)
  }
})

browser.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    stopTimer()
  }
})
