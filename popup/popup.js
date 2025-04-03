/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

document.getElementById('main-page').addEventListener('click', () => {
  const addonPageURL = browser.runtime.getURL('public/index.html')
  browser.tabs.create({ url: addonPageURL })
})
