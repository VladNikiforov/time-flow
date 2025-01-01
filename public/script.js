const displayData = document.getElementById('displayData')

document.getElementById('getData').addEventListener('click', () => {
  chrome.storage.local.get(['data'], (result) => {
    if (result.data) {
      displayData.innerText = JSON.stringify(result.data)
      console.log(JSON.stringify(result.data))
    } else {
      displayData.innerText = 'Error'
    }
  })
})

const ctx = document.getElementById('myChart')

new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
    datasets: [
      {
        label: '# of Votes',
        data: [12, 19, 3, 5, 2, 3],
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
