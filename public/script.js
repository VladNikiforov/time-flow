let data

fetch('/data')
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  })
  .then((receivedData) => {
    console.log('Received data from server:', receivedData)

    data = receivedData

    if (data) {
      displayData.innerText = JSON.stringify(data)

      const dates = Object.keys(data.data)
      const times = Object.values(data.data).map((entries) => entries.reduce((sum, entry) => sum + entry.time, 0))

      console.log('dates:', dates)
      console.log('times:', times)

      const ctx = document.getElementById('myChart')
      const secondChartCanvas = document.getElementById('dayChart').getContext('2d')

      new Chart(ctx, {
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
          scales: {
            y: {
              beginAtZero: true,
            },
          },
          onClick: (event, elements) => {
            if (elements.length > 0) {
              const index = elements[0].index
              const label = dates[index]
              const entries = Object.values(data.data)[index]

              renderSecondChart(label, entries, secondChartCanvas)
            }
          },
        },
      })
    } else {
      displayData.innerText = 'Error'
    }
  })

function renderSecondChart(label, entries, canvas) {
  const times = entries.map((entry) => entry.time)
  const labels = entries.map((entry) => entry.website)

  if (window.secondChart) {
    window.secondChart.destroy()
  }

  window.secondChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
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
    },
  })
}
