if (typeof browser === 'undefined') {
  var browser = chrome
}

let timerInterval
let startTime = 0 // Timestamp when tracking starts
let elapsedSeconds = 0 // Total time spent on the current tab
let currentTabId
let currentTabUrl = ''

const STORE_NAME = 'BrowsingData'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BrowsingDataDB', 1)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('date', 'date', { unique: false })
        store.createIndex('url', 'url', { unique: false })
      }
    }

    request.onsuccess = (event) => resolve(event.target.result)
    request.onerror = (event) => reject(request.error)
  })
}

async function getData(date) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('date')

    const request = index.getAll(date)

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

async function saveData(data) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(data)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function postDataToServer(data) {
  try {
    const response = await fetch('http://localhost:3000/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await response.json()
    console.log('Response from server:', result)
  } catch (error) {
    console.error('Error posting data:', error)
  }
}

function getDomain(url) {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.hostname
  } catch {
    return 'Unknown URL'
  }
}

function getTodayDate() {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

function calculateElapsedTime() {
  if (startTime) {
    const now = Date.now()
    elapsedSeconds += Math.floor((now - startTime) / 1000)
    startTime = now // Reset start time for further tracking
  }
}

function startTimer(tabId) {
  clearInterval(timerInterval)
  calculateElapsedTime()

  currentTabId = tabId

  browser.tabs.get(tabId, (tab) => {
    currentTabUrl = tab.url || ''
    console.log(`Started timer on: ${currentTabUrl}`)
  })

  startTime = Date.now()
  timerInterval = setInterval(calculateElapsedTime, 1000) // Update elapsedSeconds every second
}

async function stopTimer() {
  if (currentTabId && currentTabUrl) {
    calculateElapsedTime() // Finalize time before stopping

    const today = getTodayDate()
    console.log(`URL: ${currentTabUrl}, Total Time: ${elapsedSeconds} seconds`)

    const data = await getData(today)

    const siteData = data.find((entry) => entry.url === currentTabUrl)
    if (siteData) {
      siteData.time += elapsedSeconds
      await saveData(siteData) // Update the existing entry
    } else {
      const newData = { date: today, url: currentTabUrl, time: elapsedSeconds }
      await saveData(newData) // Add a new entry
    }

    postDataToServer(data)
  }

  clearInterval(timerInterval)
  elapsedSeconds = 0 // Reset time for the next session
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
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    stopTimer()
  }
})
