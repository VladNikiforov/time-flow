let rawData = null

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

function getStartOfWeek(date) {
  const day = date.getDay() - 1
  const difference = date.getDate() - day + (day === 0 ? -6 : 1)
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

let currentStartDate = null
function getStartDate() {
  const now = new Date()
  currentStartDate = viewRange === 'Week' ? getStartOfWeek(now) : getStartOfMonth(now)
  updateChart()
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action !== 'sendData') {
    console.error('Error receiving data from background.js:', rawData)
  }

  rawData = message.data
  console.log('Received data from background.js:', rawData)
  getStartDate()
})

document.getElementById('prevButton').addEventListener('click', () => navigateChart(-1))
document.getElementById('nextButton').addEventListener('click', () => navigateChart(1))

function updateChart() {
  if (!rawData) return
  const dateRange = generateDateRange(currentStartDate)
  const filledData = fillMissingDates(rawData, dateRange)
  renderMainChart(filledData)
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

function generateDateRange(startDate) {
  let range = []
  if (viewRange === 'Week') {
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      range.push(date.toISOString().split('T')[0])
    }
  } else if (viewRange === 'Month') {
    const daysInMonth = getDaysInMonth(startDate)
    for (let i = 0; i < daysInMonth; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth(), i + 1)
      range.push(date.toISOString().split('T')[0])
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

function formatKey(key) {
  return key.length > 24 ? key.slice(0, 24) + '...' : key
}

function renderMainChart(data) {
  const mainChartCanvas = document.getElementById('mainChart')
  if (window.chartInstance) window.chartInstance.destroy()

  const dates = Object.keys(data)
  const values = getValues(dates, data)

  updateAverage(values)
  updateTitle()
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

function updateTitle() {
  document.querySelector('h1').textContent = `Web Usage - ${viewRange}ly View`
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
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgb(75, 192, 192)',
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
        ticks: { color: '#fff' },
        grid: { color: 'rgba(255,255,255,0.1)' },
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatValue(value),
          color: '#fff',
        },
        grid: { color: 'rgba(255,255,255,0.1)' },
      },
    },
    onClick: (_, elements) => handleChartClick(elements, dates, data),
  }
}

function handleChartClick(elements, dates, data) {
  if (elements.length > 0) {
    const index = elements[0].index
    const label = dates[index]
    renderDetailChart(data[label], document.getElementById('detailChart').getContext('2d'))
  }
}

function renderDetailChart(entries, canvas) {
  const aggregatedData = aggregateEntries(entries)
  const { websites, values, totalSpentTime } = processAggregatedData(aggregatedData)

  destroyPreviousChart()
  createDetailChart(canvas, websites, values)
  renderProgressBars(websites, values, totalSpentTime)
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

function destroyPreviousChart() {
  if (window.detailChartInstance) {
    window.detailChartInstance.destroy()
  }
}

function createDetailChart(canvas, websites, values) {
  const backgroundColors = websites.map((_, index) => `hsla(${180 + index * 30}, 48%, 52%, 0.2)`)
  const borderColors = websites.map((_, index) => `hsl(${180 + index * 30}, 48%, 52%)`)

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

function renderProgressBars(websites, values, totalSpentTime) {
  const progressContainer = document.getElementById('progressContainer')
  progressContainer.innerHTML = ''

  websites.forEach((website, index) => {
    const percentage = Math.round((values[index] / totalSpentTime) * 100)
    const entryContainer = createProgressEntry(website, values[index], percentage, index)
    progressContainer.appendChild(entryContainer)
  })

  const totalTime = document.createElement('p')
  totalTime.textContent = `Total: ${formatValue(totalSpentTime)}`
  progressContainer.appendChild(totalTime)
}

function createProgressEntry(website, value, percentage, index) {
  const entryContainer = document.createElement('div')
  entryContainer.classList.add('gridDisplay')

  const labelText = document.createElement('span')
  labelText.textContent = formatKey(website)
  entryContainer.appendChild(labelText)

  const progressBar = document.createElement('progress')
  progressBar.max = 100
  progressBar.value = percentage
  progressBar.style.setProperty('--progress-bar-background', `hsla(${180 + index * 30}, 48%, 52%, 0.2)`)
  progressBar.style.setProperty('--progress-bar-fill', `hsl(${180 + index * 30}, 48%, 52%)`)
  entryContainer.appendChild(progressBar)

  const valueText = document.createElement('span')
  valueText.style.textAlign = 'center'
  valueText.textContent = `${formatValue(value)} (${percentage}%)`
  entryContainer.appendChild(valueText)

  return entryContainer
}

//TODO
function settingsPopup() {
  const settingsIcon = document.getElementById('settingsIcon')
  const overlay = document.getElementById('overlay')
  const popup = document.getElementById('popup')
  const closeButton = document.getElementById('closeButton')
  const theme = document.getElementById('theme')

  theme.addEventListener('change', () => {
    if (theme.checked) {
      document.body.style.backgroundColor = '#fff'
      document.body.style.color = '#000'
    }
  })

  settingsIcon.addEventListener('click', () => {
    overlay.style.display = 'block'
    popup.style.display = 'block'
  })

  closeButton.addEventListener('click', () => {
    overlay.style.display = 'none'
    popup.style.display = 'none'
  })

  overlay.addEventListener('click', () => {
    overlay.style.display = 'none'
    popup.style.display = 'none'
  })
}
settingsPopup()
