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
