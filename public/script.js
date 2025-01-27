let rawData

browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'sendData') {
    const data = message.data
    rawData = data
    console.log('Received formatted data from background.js:', data)

    const displayData = document.getElementById('displayData')
    displayData.textContent = `Received data: ${JSON.stringify(data)}`

    currentStartDate = getEarliestDate(data)
    updateChart(data)
  }
})

let currentView = 'week'
let currentStartDate = null

document.getElementById('prevButton').addEventListener('click', () => navigateChart(-1))
document.getElementById('nextButton').addEventListener('click', () => navigateChart(1))
document.getElementById('viewMain').addEventListener('change', (event) => {
  currentView = event.target.value
  updateChart()
})

function updateChart(data) {
  const dateRange = generateDateRange(currentStartDate, currentView)
  const filledData = fillMissingDates(data, dateRange)
  renderMainChart(filledData)
}

function navigateChart(direction) {
  const step = currentView === 'week' ? 7 : 30
  currentStartDate.setDate(currentStartDate.getDate() + step * direction)
  updateChart(rawData)
}

function getEarliestDate(data) {
  const allDates = Object.keys(data).sort()
  return new Date(allDates[0])
}

function generateDateRange(startDate, view) {
  let range = []
  let days = view === 'week' ? 7 : 30
  for (let i = 0; i < days; i++) {
    let date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    range.push(date.toISOString().split('T')[0])
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

function formatTime(value) {
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60

  if (value < 60) return `${value}s`
  if (value < 3600) return `${minutes}m${seconds ? ` ${seconds}s` : ''}`
  return `${hours}h${minutes ? ` ${minutes}m` : ''}${seconds ? ` ${seconds}s` : ''}`
}

function renderMainChart(data) {
  const mainChartCanvas = document.getElementById('mainChart')

  if (window.chartInstance) {
    window.chartInstance.destroy()
  }

  const dates = Object.keys(data)
  const times = dates.map((date) => data[date].reduce((sum, entry) => sum + entry.time, 0))

  window.chartInstance = new Chart(mainChartCanvas, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Time spent on each Day',
          data: times,
          borderWidth: 1,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          maxBarThickness: 100,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Web Usage',
          font: { size: 24, weight: 'bold' },
          color: '#fff',
        },
        tooltip: {
          callbacks: {
            label: (context) => formatTime(context.raw),
          },
        },
        legend: {
          labels: {
            color: '#fff',
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#fff',
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatTime(value),
            color: '#fff',
          },
        },
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index
          const label = dates[index]
          renderDetailChart(label, data[label], detailChart.getContext('2d'))
        }
      },
    },
  })
}

function renderDetailChart(label, entries, canvas) {
  const viewMode = document.getElementById('viewDetail').value
  const aggregatedData = {}

  entries.forEach((entry) => {
    if (viewMode == 'time') {
      aggregatedData[entry.website] = (aggregatedData[entry.website] || 0) + entry.time
    } else if (viewMode == 'sessions') {
      aggregatedData[entry.website] = (aggregatedData[entry.website] || 0) + 1
    }
  })

  const websites = Object.keys(aggregatedData)
  const values = Object.values(aggregatedData)
  const totalSpentTime = values.reduce((sum, value) => sum + value, 0)

  if (window.secondChart) {
    window.secondChart.destroy()
  }

  window.secondChart = new Chart(canvas, {
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
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => (viewMode == 'time' ? formatTime(context.raw) : `${context.raw} sessions`),
          },
        },
      },
    },
  })

  const progressContainer = document.getElementById('progressContainer')

  while (progressContainer.firstChild) {
    progressContainer.removeChild(progressContainer.firstChild)
  }

  websites.forEach((website, index) => {
    const percentage = Math.round((values[index] / totalSpentTime) * 100)
    const entryContainer = document.createElement('div')
    entryContainer.classList.add('gridDisplay')

    const textWebsite = document.createElement('span')
    textWebsite.textContent = website
    entryContainer.appendChild(textWebsite)

    const progressBar = document.createElement('progress')
    progressBar.max = 100
    progressBar.value = percentage
    progressBar.style.setProperty('background-color', '#ddd')
    progressBar.style.setProperty('--progress-bar-fill', window.secondChart.data.datasets[0].backgroundColor[index])
    progressBar.style.height = '1rem'
    progressBar.style.borderRadius = '1rem'
    entryContainer.appendChild(progressBar)

    const textNumbers = document.createElement('span')
    textNumbers.textContent = viewMode == 'time' ? `${formatTime(values[index])} (${percentage}%)` : `${values[index]} session${values[index] === 1 ? '' : 's'} (${percentage}%)`
    entryContainer.appendChild(textNumbers)

    progressContainer.appendChild(entryContainer)

    if (!document.getElementById('progress-styles')) {
      const style = document.createElement('style')
      style.id = 'progress-styles'
      style.textContent = `
        progress::-webkit-progress-value {
          background-color: var(--progress-bar-fill); 
        }
        progress::-moz-progress-bar {
          background-color: var(--progress-bar-fill); 
        }
      `
      document.head.appendChild(style)
    }
  })

  const totalTime = document.createElement('p')
  totalTime.textContent = viewMode == 'time' ? `Total Time: ${formatTime(totalSpentTime)}` : `Total Sessions: ${totalSpentTime}`
  progressContainer.appendChild(totalTime)
}
