document.getElementById('main-page').addEventListener('click', () => {
  const addonPageURL = browser.runtime.getURL('index.html')
  browser.tabs.create({ url: addonPageURL })
})
