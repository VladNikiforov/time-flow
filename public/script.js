const rawData = {}
browser.runtime.onMessage.addListener(getData)
function getData(message) {
  if (message.action !== 'sendData') {
    console.error('Error receiving data from background.js:', rawData)
  }

  Object.assign(rawData, message.data)
  console.log('Received data from background.js:', rawData)
  getStartDate()
}

// Note that this is only sample data
function generateSampleData() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const isoDate = toLocalISODate(date)

    rawData[isoDate] = Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => ({
      website: `example${Math.floor(Math.random() * 10)}.com`,
      time: Math.floor(Math.random() * 3600) + 60,
    }))
  }

  console.log('Generated mock rawData:', rawData)
}
generateSampleData()

let isDark = true
let uiHue = 180

const viewRangeElement = document.getElementById('viewRange')
const viewModeElement = document.getElementById('viewMode')

let viewRange = viewRangeElement.value
let viewMode = viewModeElement.value

viewRangeElement.addEventListener('change', () => {
  viewRange = viewRangeElement.value
  getStartDate()
})

viewModeElement.addEventListener('change', () => {
  viewMode = viewModeElement.value
  updateChart()
})

let currentStartDate = null
function getStartDate() {
  const now = new Date()
  currentStartDate = viewRange === 'Week' ? getStartOfWeek(now) : getStartOfMonth(now)
  updateChart()
}

function getStartOfWeek(date) {
  const day = date.getDay()
  const difference = date.getDate() - (day === 0 ? 6 : day - 1)
  const startOfWeek = new Date(date)
  startOfWeek.setDate(difference)
  startOfWeek.setHours(0, 0, 0, 0)
  return startOfWeek
}

function getStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

const prevButton = document.getElementById('prevButton')
const nextButton = document.getElementById('nextButton')

prevButton.addEventListener('click', () => navigateChart(-1))
nextButton.addEventListener('click', () => navigateChart(1))

function updateChart() {
  const dateRange = generateDateRange(currentStartDate)
  const filledData = fillMissingDates(rawData, dateRange)
  renderMainChart(filledData)
  updateDailyStats(dateRange, filledData)
}

function updateDailyStats(dateRange, filledData) {
  const today = toLocalISODate(new Date())
  const simulatedElement = [{ index: dateRange.indexOf(today) }]
  handleChartClick(simulatedElement, dateRange, filledData)
}

const prevStat = document.getElementById('prevStat')
const nextStat = document.getElementById('nextStat')

prevStat.addEventListener('click', () => navigateStats(-1))
nextStat.addEventListener('click', () => navigateStats(1))

let currentStatIndex = 0

function navigateStats(direction) {
  const dateRange = generateDateRange(currentStartDate)
  const filledData = fillMissingDates(rawData, dateRange)

  currentStatIndex += direction
  if (currentStatIndex < 0) currentStatIndex = dateRange.length - 1
  if (currentStatIndex >= dateRange.length) currentStatIndex = 0

  const today = toLocalISODate(new Date())
  const currentIndex = (dateRange.indexOf(today) + currentStatIndex) % dateRange.length

  document.getElementById('date').textContent = dateRange[currentIndex]

  const simulatedElement = { index: currentIndex }
  handleChartClick([simulatedElement], dateRange, filledData)
}

function navigateChart(direction) {
  if (viewRange === 'Week') {
    const date = currentStartDate.getDate()
    currentStartDate.setDate(date + direction * 7)
  } else if (viewRange === 'Month') {
    const year = currentStartDate.getFullYear()
    const month = currentStartDate.getMonth() + direction
    currentStartDate = new Date(year, month, 1)
  }
  updateChart()
}

function toLocalISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function generateDateRange(startDate) {
  let range = []
  if (viewRange === 'Week') {
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      range.push(toLocalISODate(date))
    }
  } else if (viewRange === 'Month') {
    const daysInMonth = getDaysInMonth(startDate)
    for (let i = 0; i < daysInMonth; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth(), i + 1)
      range.push(toLocalISODate(date))
    }
  }
  return range
}

function fillMissingDates(data, dateRange) {
  let filledData = {}
  dateRange.forEach((date) => {
    filledData[date] = data[date] || [{ time: 0 }]
  })
  return filledData
}

function formatKey(key) {
  return key.length > 24 ? key.slice(0, 24) + '...' : key
}

function formatValue(value) {
  if (viewMode === 'time') {
    const h = Math.floor(value / 3600)
    const m = Math.floor((value % 3600) / 60)
    const s = value % 60

    return h ? `${h}h${m ? ` ${m}m` : ''}${s ? ` ${s}s` : ''}` : m ? `${m}m${s ? ` ${s}s` : ''}` : `${s}s`
  } else if (viewMode === 'sessions') {
    return `${value} session${value === 1 ? '' : 's'}`
  }
}

function renderMainChart(data) {
  const mainChartCanvas = document.getElementById('mainChart')
  if (window.chartInstance) window.chartInstance.destroy()

  const dates = Object.keys(data)
  const values = getValues(dates, data)

  updateAverage(values)
  createMainChart(mainChartCanvas, dates, values, data)
}

function getValues(dates, data) {
  return dates.map((date) => {
    return viewMode === 'time' ? data[date].reduce((sum, entry) => sum + entry.time, 0) : data[date].length - 1
  })
}

function updateAverage(values) {
  const averageValue = Math.round(values.reduce((sum, time) => sum + time, 0) / values.length)
  document.getElementById('average').textContent = `${viewRange} Average: ${formatValue(averageValue)}`
}

function createMainChart(canvas, dates, values, data) {
  window.chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: formatLabels(dates),
      datasets: [
        {
          data: values,
          borderWidth: 1,
          backgroundColor: colorAlgorithm('dark'),
          borderColor: colorAlgorithm('light'),
          maxBarThickness: 100,
        },
      ],
    },
    options: getChartOptions(dates, data),
  })
}

function formatLabels(dates) {
  return dates.map((date) => {
    const d = new Date(date)
    return viewRange === 'Week' ? `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}` : d.getDate()
  })
}

function getChartOptions(dates, data) {
  return {
    animation: {
      duration: 0,
    },
    responsive: true,
    plugins: {
      title: { display: false },
      tooltip: {
        callbacks: {
          title: (context) => context[0].label,
          label: (context) => formatValue(context.raw),
        },
      },
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: {
          color: isDark ? '#fff' : '#000',
        },
        grid: { color: isDark ? '#ffffff1a' : '#0000001a' },
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatValue(value),
          color: isDark ? '#fff' : '#000',
        },
        grid: { color: isDark ? '#ffffff1a' : '#0000001a' },
      },
    },
    onClick: (_, elements) => handleChartClick(elements, dates, data),
  }
}

function handleChartClick(elements, dates, data) {
  if (elements.length == 0) return
  const index = elements[0].index
  const label = dates[index]
  renderDetailChart(data[label], document.getElementById('detailChart').getContext('2d'))
  document.getElementById('date').textContent = label
}

function renderDetailChart(entries, canvas) {
  const aggregatedData = aggregateEntries(entries)
  const { websites, values, totalSpentTime } = processAggregatedData(aggregatedData)

  destroyPreviousChart()
  createDetailChart(canvas, websites, values)
  renderProgressBars(websites, values, totalSpentTime)
}

function destroyPreviousChart() {
  if (window.detailChartInstance) {
    window.detailChartInstance.destroy()
  }
}

function aggregateEntries(entries) {
  const aggregatedData = entries.reduce((acc, entry) => {
    acc[entry.website] = (acc[entry.website] || 0) + (viewMode === 'time' ? entry.time : 1)
    return acc
  }, {})

  const sortedAggregatedData = Object.entries(aggregatedData)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [website, value]) => {
      acc[website] = value
      return acc
    }, {})

  return sortedAggregatedData
}

function processAggregatedData(aggregatedData) {
  const websites = Object.keys(aggregatedData)
  const values = Object.values(aggregatedData)
  const totalSpentTime = values.reduce((sum, value) => sum + value, 0)
  return { websites, values, totalSpentTime }
}

function colorAlgorithm(color, index = 0) {
  const colorFormula = `${uiHue + index * 20}, 48%, 52%`
  return color === 'dark' ? `hsla(${colorFormula}, 0.2)` : `hsl(${colorFormula})`
}

function createDetailChart(canvas, websites, values) {
  const backgroundColors = websites.map((_, index) => colorAlgorithm('dark', index))
  const borderColors = websites.map((_, index) => colorAlgorithm('light', index))

  window.detailChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: websites,
      datasets: [
        {
          data: values,
          borderWidth: 1,
          borderRadius: 8,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: '40%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatValue(context.raw),
          },
        },
      },
    },
  })
}

const maxItems = 3
function renderProgressBars(websites, values, totalSpentTime) {
  const progressContainer = document.getElementById('progressContainer')
  progressContainer.innerHTML = ''

  const entries = websites.map((website, index) => {
    const percentage = Math.round((values[index] / totalSpentTime) * 100)
    const entryContainer = createProgressEntry(website, values[index], percentage, index)
    progressContainer.appendChild(entryContainer)
    return entryContainer
  })

  if (websites.length > maxItems) {
    const showMoreButton = document.createElement('button')
    showMoreButton.textContent = 'Show All'
    showMoreButton.style.marginRight = '1rem'
    showMoreButton.addEventListener('click', () => {
      entries.slice(maxItems).forEach((entry) => {
        entry.classList.remove('hidden')
      })
      showMoreButton.style.display = 'none'
    })
    progressContainer.appendChild(showMoreButton)
  }

  const totalTime = document.createElement('span')
  totalTime.textContent = `Total: ${formatValue(totalSpentTime)}`
  progressContainer.appendChild(totalTime)
}

function createProgressEntry(website, value, percentage, index) {
  const entryContainer = document.createElement('div')
  entryContainer.classList.add('gridDisplay')

  if (index >= maxItems) {
    entryContainer.classList.add('hidden')
  }

  const labelText = document.createElement('span')
  labelText.textContent = formatKey(website)
  entryContainer.appendChild(labelText)

  const progressBar = document.createElement('progress')
  progressBar.max = 100
  progressBar.value = percentage
  progressBar.style.setProperty('--progress-bar-background', colorAlgorithm('dark', index))
  progressBar.style.setProperty('--progress-bar-fill', colorAlgorithm('light', index))
  entryContainer.appendChild(progressBar)

  const valueText = document.createElement('span')
  valueText.style.textAlign = 'center'
  valueText.textContent = `${formatValue(value)} (${percentage}%)`
  entryContainer.appendChild(valueText)

  return entryContainer
}

const settingsIcon = document.getElementById('settingsIcon')
const overlay = document.getElementById('overlay')
const popup = document.getElementById('popup')
const closeButton = document.getElementById('closeButton')
const themeIcon = document.getElementById('themeIcon')
const hueSlider = document.getElementById('hueSlider')

function applyTheme() {
  const backgroundColor = isDark ? '#222' : '#eee'
  const textColor = isDark ? '#fff' : '#000'
  const themeIconSrc = isDark ? 'light' : 'dark'
  const filterValue = `invert(${+isDark})`

  document.documentElement.style.setProperty('--background-color', backgroundColor)
  document.documentElement.style.setProperty('--text-color', textColor)
  themeIcon.src = `assets/theme/${themeIconSrc}-icon.svg`
  themeIcon.style.filter = filterValue
  settingsIcon.style.filter = filterValue

  updateChart()
}

themeIcon.addEventListener('click', () => {
  isDark = !isDark
  applyTheme()
})

function togglePopup(action) {
  const actionCheck = action === 'open' ? 'block' : 'none'
  overlay.style.display = actionCheck
  popup.style.display = actionCheck
}

settingsIcon.addEventListener('click', () => togglePopup('open'))
closeButton.addEventListener('click', () => togglePopup('close'))
overlay.addEventListener('click', () => togglePopup('close'))

hueSlider.addEventListener('input', () => {
  uiHue = hueSlider.value
  document.documentElement.style.setProperty('--special-color-dark', colorAlgorithm('dark'))
  document.documentElement.style.setProperty('--special-color-light', colorAlgorithm('light'))
  updateChart()
})

hueSlider.addEventListener('mousedown', () => (popup.style.visibility = 'hidden'))
hueSlider.addEventListener('mouseup', () => (popup.style.visibility = 'visible'))

/*
function easterEgg() {
  let sequence = ''
  const target = 'cool'
  let interval = null

  document.addEventListener('keydown', (event) => {
    sequence += event.key.toLowerCase()

    if (!target.startsWith(sequence)) {
      sequence = event.key.toLowerCase()
    }

    if (sequence === target) {
      if (interval) clearInterval(interval)

      interval = setInterval(() => {
        uiHue = (uiHue + 1) % 360
        document.documentElement.style.setProperty('--special-color-dark', colorAlgorithm('dark'))
        document.documentElement.style.setProperty('--special-color-light', colorAlgorithm('light'))
        updateChart()
      }, 50)

      sequence = ''
    }
  })
}
easterEgg()
*/
