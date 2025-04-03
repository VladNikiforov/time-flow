/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id
const browserAPI = isFirefox ? browser : chrome

document.getElementById('main-page').addEventListener('click', () => {
  const addonPageURL = browserAPI.runtime.getURL('public/index.html')

  browserAPI.tabs.create({ url: addonPageURL })
})
