/*browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'sendData') {
    const data = message.data
    console.log('Received formatted data from background.js:', data)

    const displayData = document.getElementById('displayData')
    displayData.textContent = `Received data: ${JSON.stringify(data)}`

    renderMainChart(data)
  }
})*/

let data = {
  '2025-01-01': [
    { website: 'youtube.com', time: 5 },
    { website: 'chatgpt.com', time: 7 },
  ],
  '2025-01-02': [{ website: 'chatgpt.com', time: 7 }],
  '2025-01-03': [
    { website: 'skool.com', time: 4 },
    { website: 'chatgpt.com', time: 10 },
    { website: 'youtube.com', time: 9 },
  ],
  '2025-01-04': [
    { website: 'skool.com', time: 5 },
    { website: 'chatgpt.com', time: 7 },
    { website: 'youtube.com', time: 8 },
  ],
  '2025-01-05': [
    { website: 'skool.com', time: 8 },
    { website: 'chatgpt.com', time: 7 },
  ],
  '2025-01-06': [
    { website: 'chatgpt.com', time: 8 },
    { website: 'skool.com', time: 6 },
    { website: 'youtube.com', time: 9 },
  ],
  '2025-01-07': [
    { website: 'chatgpt.com', time: 1 },
    { website: 'youtube.com', time: 9 },
  ],
  '2025-01-08': [
    { website: 'chatgpt.com', time: 9 },
    { website: 'skool.com', time: 3 },
  ],
  '2025-01-09': [{ website: 'chatgpt.com', time: 2 }],
  '2025-01-10': [{ website: 'skool.com', time: 6 }],
  '2025-01-11': [
    { website: 'youtube.com', time: 2 },
    { website: 'skool.com', time: 9 },
  ],
  '2025-01-12': [
    { website: 'youtube.com', time: 2 },
    { website: 'skool.com', time: 4 },
  ],
  '2025-01-13': [
    { website: 'youtube.com', time: 8 },
    { website: 'chatgpt.com', time: 4 },
  ],
  '2025-01-14': [{ website: 'skool.com', time: 6 }],
  '2025-01-15': [{ website: 'skool.com', time: 8 }],
  '2025-01-16': [
    { website: 'youtube.com', time: 10 },
    { website: 'chatgpt.com', time: 3 },
  ],
  '2025-01-17': [{ website: 'chatgpt.com', time: 2 }],
  '2025-01-18': [
    { website: 'skool.com', time: 4 },
    { website: 'youtube.com', time: 9 },
  ],
  '2025-01-19': [{ website: 'skool.com', time: 3 }],
  '2025-01-20': [{ website: 'chatgpt.com', time: 10 }],
  '2025-01-21': [
    { website: 'youtube.com', time: 5 },
    { website: 'chatgpt.com', time: 7 },
    { website: 'skool.com', time: 1 },
  ],
  '2025-01-22': [
    { website: 'chatgpt.com', time: 5 },
    { website: 'youtube.com', time: 5 },
    { website: 'skool.com', time: 6 },
  ],
  '2025-01-23': [
    { website: 'skool.com', time: 3 },
    { website: 'youtube.com', time: 3 },
    { website: 'chatgpt.com', time: 7 },
  ],
  '2025-01-24': [
    { website: 'chatgpt.com', time: 7 },
    { website: 'youtube.com', time: 10 },
    { website: 'skool.com', time: 3 },
  ],
  '2025-01-25': [{ website: 'skool.com', time: 10 }],
  '2025-01-26': [
    { website: 'youtube.com', time: 10 },
    { website: 'chatgpt.com', time: 9 },
  ],
  '2025-01-27': [
    { website: 'skool.com', time: 9 },
    { website: 'chatgpt.com', time: 8 },
    { website: 'youtube.com', time: 1 },
  ],
  '2025-01-28': [
    { website: 'chatgpt.com', time: 3 },
    { website: 'skool.com', time: 6 },
    { website: 'youtube.com', time: 6 },
  ],
  '2025-01-29': [{ website: 'chatgpt.com', time: 2 }],
  '2025-01-30': [
    { website: 'youtube.com', time: 4 },
    { website: 'chatgpt.com', time: 4 },
  ],
  '2025-01-31': [
    { website: 'skool.com', time: 9 },
    { website: 'chatgpt.com', time: 5 },
    { website: 'youtube.com', time: 8 },
  ],
}

function formatTime(value) {
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60

  if (value < 60) return `${value}s`
  if (value < 3600) return `${minutes}m${seconds ? ` ${seconds}s` : ''}`
  return `${hours}h${minutes ? ` ${minutes}m` : ''}${seconds ? ` ${seconds}s` : ''}`
}

function groupDataByWeeks(data) {
  const dates = Object.keys(data).sort()
  const groupedWeeks = []

  let currentWeek = []
  let currentDate = new Date(dates[0])
  const endDate = new Date(dates[dates.length - 1])

  if (currentDate.getDay() !== 1) {
    currentDate.setDate(currentDate.getDate() - (currentDate.getDay() || 7) + 1)
  }

  while (currentDate <= endDate || currentWeek.length < 7) {
    const formattedDate = currentDate.toISOString().split('T')[0]

    if (currentWeek.length === 7) {
      groupedWeeks.push(currentWeek)
      currentWeek = []
    }

    if (data[formattedDate]) {
      currentWeek.push({ date: formattedDate, entries: data[formattedDate] })
    } else {
      currentWeek.push({ date: formattedDate, entries: [] })
    }

    currentDate.setDate(currentDate.getDate() + 1)

    if (currentDate > endDate && currentWeek.length < 7) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: '', entries: [] })
      }
    }
  }

  if (currentWeek.length > 0) {
    groupedWeeks.push(currentWeek)
  }

  return groupedWeeks
}

let currentWeekIndex = 0
let groupedWeeks = []

function setupWeeklyChartNavigation(data) {
  groupedWeeks = groupDataByWeeks(data)
  currentWeekIndex = 0

  const prevButton = document.getElementById('prevButton')
  const nextButton = document.getElementById('nextButton')

  prevButton.addEventListener('click', () => changeWeek(-1))
  nextButton.addEventListener('click', () => changeWeek(1))

  renderCurrentWeek()
}

function changeWeek(direction) {
  const newIndex = currentWeekIndex + direction
  if (newIndex >= 0 && newIndex < groupedWeeks.length) {
    currentWeekIndex = newIndex
    renderCurrentWeek()
  }
}

function renderCurrentWeek() {
  const currentWeek = groupedWeeks[currentWeekIndex]
  const dates = currentWeek.map((day) => day.date || 'N/A')
  const times = currentWeek.map((day) => day.entries.reduce((sum, entry) => sum + entry.time, 0))

  const mainChartCanvas = document.getElementById('mainChart')

  if (window.chartInstance) {
    window.chartInstance.destroy()
  }

  window.chartInstance = new Chart(mainChartCanvas, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Time spent on each Day',
          data: times,
          borderWidth: 1,
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
          display: false,
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
  const filteredEntries = entries.filter((entry) => entry.website !== '' && entry.time !== 0)

  const websites = filteredEntries.map((entry) => entry.website)
  const times = filteredEntries.map((entry) => entry.time)
  const totalSpentTime = times.reduce((sum, time) => sum + time, 0)

  if (window.secondChart) {
    window.secondChart.destroy()
  }

  window.secondChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: websites,
      datasets: [
        {
          label: 'Time spent on each Website',
          data: times,
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: '40%',
      plugins: {
        title: {
          display: true,
          text: label,
          font: { size: 16, weight: 'bold' },
          color: '#fff',
        },
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => formatTime(context.raw),
          },
        },
      },
    },
  })

  const chartColors = window.secondChart.data.datasets[0].backgroundColor

  const progressContainer = document.getElementById('progressContainer')

  while (progressContainer.firstChild) {
    progressContainer.removeChild(progressContainer.firstChild)
  }

  filteredEntries.forEach((entry, colorIndex) => {
    const percentage = Math.round((entry.time / totalSpentTime) * 100)
    const entryContainer = document.createElement('div')

    const textWebsite = document.createElement('span')
    textWebsite.textContent = entry.website
    entryContainer.appendChild(textWebsite)

    const progressBar = document.createElement('progress')
    progressBar.max = 100
    progressBar.value = percentage
    progressBar.style.setProperty('background-color', '#ddd')
    progressBar.style.setProperty('--progress-bar-fill', chartColors[colorIndex])
    progressBar.style.height = '1rem'
    progressBar.style.borderRadius = '1rem'
    entryContainer.appendChild(progressBar)

    const textNumbers = document.createElement('span')
    textNumbers.textContent = `${formatTime(entry.time)} (${percentage}%)`
    entryContainer.appendChild(textNumbers)

    entryContainer.classList.add('gridDisplay')
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
  totalTime.textContent = `Total Time: ${formatTime(totalSpentTime)}`
  progressContainer.appendChild(totalTime)
}

setupWeeklyChartNavigation(data)
