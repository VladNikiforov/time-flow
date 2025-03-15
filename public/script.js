let rawData = null
let currentStartDate = null
let viewRange = document.getElementById('viewRange').value

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

function viewCheck() {
  const now = new Date()
  currentStartDate = viewRange === 'week' ? getStartOfWeek(now) : getStartOfMonth(now)
  updateChart()
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'sendData') {
    rawData = message.data
    console.log('Received data from background.js:', rawData)
    viewCheck()
  }
})

document.getElementById('prevButton').addEventListener('click', () => navigateChart(-1))
document.getElementById('nextButton').addEventListener('click', () => navigateChart(1))

document.getElementById('viewRange').addEventListener('change', (event) => {
  viewRange = event.target.value
  viewCheck()
})

function updateChart() {
  if (!rawData) return
  const dateRange = generateDateRange(currentStartDate)
  const filledData = fillMissingDates(rawData, dateRange)
  renderMainChart(filledData)
}

function navigateChart(direction) {
  if (viewRange === 'week') {
    const date = currentStartDate.getDate()
    currentStartDate.setDate(date + direction * 7)
  } else {
    const year = currentStartDate.getFullYear()
    const month = currentStartDate.getMonth() + direction
    currentStartDate = new Date(year, month, 1)
  }
  updateChart()
}

function generateDateRange(startDate) {
  let range = []
  if (viewRange === 'week') {
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      range.push(date.toISOString().split('T')[0])
    }
  } else {
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

document.getElementById('viewMode').addEventListener('change', () => {
  updateChart()
})

function formatTime(value) {
  const h = Math.floor(value / 3600)
  const m = Math.floor((value % 3600) / 60)
  const s = value % 60

  return h ? `${h}h${m ? ` ${m}m` : ''}${s ? ` ${s}s` : ''}` : m ? `${m}m${s ? ` ${s}s` : ''}` : `${s}s`
}

function formatKey(key) {
  return key.length > 24 ? key.slice(0, 24) + '...' : key
}

function renderMainChart(data) {
  const mainChartCanvas = document.getElementById('mainChart')
  if (window.chartInstance) window.chartInstance.destroy()

  const dates = Object.keys(data)
  const viewMode = document.getElementById('viewMode').value
  const times = calculateTimes(dates, data, viewMode)

  updateAverage(times, viewMode)
  updateTitle()
  createMainChart(mainChartCanvas, dates, times, viewMode, data)
}

function calculateTimes(dates, data, viewMode) {
  return dates.map((date) => {
    return viewMode === 'time' ? data[date].reduce((sum, entry) => sum + entry.time, 0) : data[date].length - 1
  })
}

function updateAverage(times, viewMode) {
  const averageValue = Math.round(times.reduce((sum, time) => sum + time, 0) / times.length)
  document.getElementById('average').textContent = `${viewRange === 'week' ? 'Week' : 'Month'} Average: ` + (viewMode === 'time' ? formatTime(averageValue) : `${Math.round(averageValue)} sessions`)
}

function updateTitle() {
  document.getElementById('title').textContent = `Web Usage - ${viewRange === 'week' ? 'Weekly' : 'Monthly'} View`
}

function createMainChart(canvas, dates, times, viewMode, data) {
  window.chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: formatLabels(dates),
      datasets: [
        {
          label: viewMode === 'time' ? 'Time spent each Day' : 'Sessions each Day',
          data: times,
          borderWidth: 1,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          maxBarThickness: 100,
        },
      ],
    },
    options: getChartOptions(viewMode, dates, data),
  })
}

function formatLabels(dates) {
  return dates.map((date) => {
    const d = new Date(date)
    return viewRange === 'week' ? `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}` : d.getDate()
  })
}

function getChartOptions(viewMode, dates, data) {
  return {
    responsive: true,
    plugins: {
      title: { display: false },
      tooltip: {
        callbacks: {
          title: (context) => context[0].label,
          label: (context) => (viewMode === 'time' ? formatTime(context.raw) : `${context.raw} sessions`),
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
          callback: (value) => (viewMode === 'time' ? formatTime(value) : `${value} sessions`),
          color: '#fff',
        },
        grid: { color: 'rgba(255,255,255,0.1)' },
      },
    },
    onClick: (event, elements) => handleChartClick(event, elements, dates, data),
  }
}

function handleChartClick(event, elements, dates, data) {
  if (elements.length > 0) {
    const index = elements[0].index
    const label = dates[index]
    renderDetailChart(data[label], document.getElementById('detailChart').getContext('2d'))
  }
}

function renderDetailChart(entries, canvas) {
  const viewMode = document.getElementById('viewMode').value
  const aggregatedData = aggregateEntries(entries, viewMode)
  const { websites, values, totalSpentTime } = processAggregatedData(aggregatedData)

  destroyPreviousChart()
  createDetailChart(canvas, websites, values, viewMode)
  renderProgressBars(websites, values, totalSpentTime, viewMode)
}

function aggregateEntries(entries, viewMode) {
  return entries.reduce((acc, entry) => {
    acc[entry.website] = (acc[entry.website] || 0) + (viewMode == 'time' ? entry.time : 1)
    return acc
  }, {})
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

function createDetailChart(canvas, websites, values, viewMode) {
  window.detailChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: websites,
      datasets: [
        {
          label: viewMode == 'time' ? 'Time spent on each Website' : 'Session count',
          data: values,
          borderWidth: 1,
          borderRadius: 8,
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
            label: (context) => (viewMode == 'time' ? formatTime(context.raw) : `${context.raw} sessions`),
          },
        },
      },
    },
  })
}

function renderProgressBars(websites, values, totalSpentTime, viewMode) {
  const progressContainer = document.getElementById('progressContainer')
  progressContainer.innerHTML = ''

  websites.forEach((website, index) => {
    const percentage = Math.round((values[index] / totalSpentTime) * 100)
    const entryContainer = createProgressEntry(website, values[index], percentage, viewMode, index)
    progressContainer.appendChild(entryContainer)
  })

  const totalTime = document.createElement('p')
  totalTime.textContent = viewMode == 'time' ? `Total Time: ${formatTime(totalSpentTime)}` : `Total Sessions: ${totalSpentTime}`
  progressContainer.appendChild(totalTime)
}

function createProgressEntry(website, value, percentage, viewMode, index) {
  const entryContainer = document.createElement('div')
  entryContainer.classList.add('gridDisplay')

  const textWebsite = document.createElement('span')
  textWebsite.textContent = formatKey(website)
  entryContainer.appendChild(textWebsite)

  const progressBar = document.createElement('progress')
  progressBar.max = 100
  progressBar.value = percentage
  progressBar.style.setProperty('--progress-bar-fill', window.detailChartInstance.data.datasets[0].backgroundColor[index])
  entryContainer.appendChild(progressBar)

  const textNumbers = document.createElement('span')
  textNumbers.style.textAlign = 'center'
  textNumbers.textContent = viewMode == 'time' ? `${formatTime(value)} (${percentage}%)` : `${value} session${value === 1 ? '' : 's'} (${percentage}%)`
  entryContainer.appendChild(textNumbers)

  return entryContainer
}
