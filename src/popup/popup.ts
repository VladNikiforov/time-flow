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

function uiHueLogic(uiHue: number) {
  type Theme = 'light' | 'dark'
  function colorAlgorithm(theme: Theme) {
    const colorFormula = `${uiHue}, 48%, 52%`
    return theme === 'dark' ? `hsla(${colorFormula}, 0.2)` : `hsl(${colorFormula})`
  }

  pageButton.style.backgroundColor = colorAlgorithm('dark')
  pageButton.style.borderColor = colorAlgorithm('light')
}

function isDarkLogic(isDark: boolean) {
  const themeConfig = isDark ? { backgroundColor: '#222', textColor: '#fff' } : { backgroundColor: '#eee', textColor: '#000' }

  document.documentElement.style.setProperty('--background-color', themeConfig.backgroundColor)
  document.documentElement.style.setProperty('--text-color', themeConfig.textColor)
}

function loadPreferences() {
  getFromStorage('uiHue', uiHueLogic)
  getFromStorage('isDark', isDarkLogic)
}

loadPreferences()
document.addEventListener('DOMContentLoaded', loadPreferences)
