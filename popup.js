document.getElementById('main-page').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000' })
})
