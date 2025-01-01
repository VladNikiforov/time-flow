let timerInterval
let elapsedSeconds = 0
let currentTabId
let currentTabDomain = ''

let data = {}

chrome.storage.local.get(['data'], (result) => {
  if (result.data) {
    data = result.data
    console.log('Loaded data:', data)

    fetch('http://localhost:3000/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.json()
      })
      .then((data) => console.log('Response from server:', data))
      .catch((error) => console.error('Fetch error:', error))
  } else {
    console.log('No data found.')
  }
})

function getDomain(url) {
  try {
    const parsedUrl = new URL(url)
    return `${parsedUrl.protocol}//${parsedUrl.hostname}`
  } catch {
    return 'Unknown URL'
  }
}

function getTodayDate() {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

function startTimer(tabId) {
  clearInterval(timerInterval)
  elapsedSeconds = 0
  currentTabId = tabId

  chrome.tabs.get(tabId, (tab) => {
    currentTabDomain = getDomain(tab.url || '')
    console.log(`Started timer on: ${currentTabDomain}`)
  })

  timerInterval = setInterval(() => {
    elapsedSeconds++
  }, 1000)
}

function stopTimer() {
  if (currentTabId) {
    const today = getTodayDate()
    console.log(`URL: ${currentTabDomain}, Total Time: ${elapsedSeconds} seconds`)

    if (!data[today]) {
      data[today] = []
    }

    const siteData = data[today].find((entry) => entry.website === currentTabDomain)
    if (siteData) {
      siteData.time += elapsedSeconds
    } else {
      data[today].push({ website: currentTabDomain, time: elapsedSeconds })
    }

    console.log('Updated data:', data)

    chrome.storage.local.set({ data }, () => {
      console.log('Data saved.')
    })
  }

  clearInterval(timerInterval)
  elapsedSeconds = 0
  currentTabId = null
  currentTabDomain = ''
}

// Listeners
chrome.tabs.onActivated.addListener((activeInfo) => {
  stopTimer()
  startTimer(activeInfo.tabId)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.status === 'complete') {
    console.log(`Tab updated: ${getDomain(tab.url)}`)
    stopTimer()
    startTimer(tabId)
  }
})

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    stopTimer()
  }
})
