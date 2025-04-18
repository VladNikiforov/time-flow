/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

window.isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id
window.browserAPI = isFirefox ? browser : chrome

const pageButton = document.getElementById('main-page') as HTMLButtonElement

pageButton.addEventListener('click', () => {
  const addonPageURL = browserAPI.runtime.getURL('public/index.html')

  browserAPI.tabs.create({ url: addonPageURL })
})

function getFromStorage(key: any, callback: any) {
  browser.storage.local.get([key]).then((result) => {
    const value = result[key]
    console.log(key === undefined ? 'No data found for key:' : 'Data retrieved:', key, value)
    callback(value)
  })
}

function uiHueLogic(value: number) {
  type Theme = 'light' | 'dark'
  function colorAlgorithm(theme: Theme) {
    const colorFormula = `${value}, 48%, 52%`
    return theme === 'dark' ? `hsla(${colorFormula}, 0.2)` : `hsl(${colorFormula})`
  }

  pageButton.style.backgroundColor = colorAlgorithm('dark')
  pageButton.style.borderColor = colorAlgorithm('light')
}

function isDarkLogic(value: boolean) {
  const backgroundColor = value ? '#222' : '#eee'
  const textColor = value ? '#fff' : '#000'

  document.documentElement.style.setProperty('--background-color', backgroundColor)
  document.documentElement.style.setProperty('--text-color', textColor)
}

function loadPreferences() {
  getFromStorage('uiHue', uiHueLogic)
  getFromStorage('isDark', isDarkLogic)
}

loadPreferences()
document.addEventListener('DOMContentLoaded', loadPreferences)
