let timerInterval
let elapsedSeconds = 0
let currentTabId
let currentTabDomain = ''

let data = []

chrome.storage.local.get(['data'], (result) => {
  if (result.data) {
    data = result.data // Load saved data
    console.log('Loaded data:', data)
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
    console.log(`URL: ${currentTabDomain}, Total Time: ${elapsedSeconds} seconds`)

    data.push({ website: currentTabDomain, time: elapsedSeconds })

    const groupData = data.reduce((accumulator, entry) => {
      if (accumulator[entry.website]) {
        accumulator[entry.website] += entry.time
      } else {
        accumulator[entry.website] = entry.time
      }
      return accumulator
    }, {})

    data = Object.entries(groupData).map(([website, time]) => ({ website, time }))

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
