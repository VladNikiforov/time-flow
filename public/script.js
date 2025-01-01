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
      console.log(JSON.stringify(data))
      const labels = data.data['2025-01-01'].map((item) => item.website || 'Unknown')
      const times = data.data['2025-01-01'].map((item) => item.time)

      const ctx = document.getElementById('myChart')

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'seconds',
              data: times,
              borderWidth: 1,
            },
          ],
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      })
    } else {
      displayData.innerText = 'Error'
    }
  })
  .catch((error) => console.error('Error fetching data:', error))
