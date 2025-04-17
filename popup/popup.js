/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id
const browserAPI = isFirefox ? browser : chrome

const pageButton = document.getElementById('main-page')

pageButton.addEventListener('click', () => {
  const addonPageURL = browserAPI.runtime.getURL('public/index.html')

  browserAPI.tabs.create({ url: addonPageURL })
})

document.addEventListener('DOMContentLoaded', () => {
  function getFromStorage(key, callback) {
    browser.storage.local.get([key]).then((result) => {
      const value = result[key]
      console.log(!value ? 'No data found for key:' : 'Data retrieved:', key, value)
      callback(key, value)
    })
  }

  function uiHueLogic(value) {
    function colorAlgorithm(color) {
      const colorFormula = `${value}, 48%, 52%`
      return color === 'dark' ? `hsla(${colorFormula}, 0.2)` : `hsl(${colorFormula})`
    }

    if (pageButton) {
      pageButton.style.backgroundColor = colorAlgorithm('dark')
      pageButton.style.borderColor = colorAlgorithm('light')
    }
  }

  function isDarkLogic(value) {
    const backgroundColor = value ? '#222' : '#eee'
    const textColor = value ? '#fff' : '#000'

    document.documentElement.style.setProperty('--background-color', backgroundColor)
    document.documentElement.style.setProperty('--text-color', textColor)
  }

  getFromStorage('uiHue', uiHueLogic)
  getFromStorage('isDark', isDarkLogic)
})
