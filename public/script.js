let data
let dates, times

const mainChart = document.getElementById('mainChart')
const detailChart = document.getElementById('detailChart')

fetch('/data')
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  })
  .then((rawData) => {
    function formatData(data) {
      const formattedData = { data: {} }

      data.forEach((item) => {
        const { date, url, time } = item

        if (!formattedData.data[date]) {
          formattedData.data[date] = []
        }

        formattedData.data[date].push({
          time: time,
          website: url || '',
        })
      })

      return formattedData
    }

    data = formatData(rawData)

    console.log('Received data from server:', rawData)
    console.log('Formatted Data:', data)

    if (data && data.data) {
      displayData.innerText = JSON.stringify(data)

      dates = Object.keys(data.data)
      times = Object.values(data.data).map((entries) => entries.reduce((sum, entry) => sum + entry.time, 0))

      renderMainChart()
    } else {
      displayData.innerText = 'Error receiving data'
    }
  })
  .catch((error) => {
    console.error('Error fetching data:', error)
  })

function formatTime(value) {
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function renderMainChart() {
  new Chart(mainChart, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Time',
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
          font: {
            size: 24,
            weight: 'bold',
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => formatTime(context.raw),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatTime(value),
          },
        },
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index
          const label = dates[index]
          const entries = Object.values(data.data)[index]

          renderDetailChart(label, entries, detailChart.getContext('2d'))
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
          label: 'Time',
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
          text: 'Details',
          font: {
            size: 16,
            weight: 'italic bold',
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => formatTime(context.raw),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatTime(value),
          },
        },
      },
    },
  })
}
