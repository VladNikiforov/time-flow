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
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
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
  const dates = entries.map((entry) => entry.website)
  const times = entries.map((entry) => entry.time)

  if (window.secondChart) {
    window.secondChart.destroy()
  }

  window.secondChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Time spent on each Website',
          data: times,
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 12,
        },
      ],
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#fff',
          },
        },
        title: {
          display: true,
          text: `Details for ${label}`,
          font: { size: 16, weight: 'italic bold' },
          color: '#fff',
        },
        tooltip: {
          callbacks: {
            label: (context) => formatTime(context.raw),
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatTime(value),
            color: '#fff',
          },
        },
        y: {
          ticks: {
            color: '#fff',
          },
        },
      },
    },
  })
}
