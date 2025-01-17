browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'sendData') {
    const data = message.data
    console.log('Received formatted data from background.js:', data)

    const displayData = document.getElementById('displayData')
    displayData.textContent = `Received data: ${JSON.stringify(data)}`

    renderMainChart(data)
  }
})

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
  const times = dates.map((date) => {
    return data[date].reduce((sum, entry) => sum + entry.time, 0)
  })

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
