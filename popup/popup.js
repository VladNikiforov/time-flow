document.getElementById('main-page').addEventListener('click', () => {
  const addonPageURL = browser.runtime.getURL('public/index.html')
  browser.tabs.create({ url: addonPageURL })
})
