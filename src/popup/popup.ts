/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

import { browserAPI, addonPageURL } from '../background'

const pageButton = document.getElementById('main-page') as HTMLButtonElement
const pauseBtn = document.getElementById('pause') as HTMLImageElement

pageButton.addEventListener('click', () => {
  browserAPI.tabs.create({ url: addonPageURL })
})

function getFromStorage(key: any, callback: any) {
  browserAPI.storage.local.get([key]).then((result) => {
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
  pauseBtn.style.filter = `invert(${+isDark})`
}

document.addEventListener('DOMContentLoaded', () => {
  getFromStorage('uiHue', uiHueLogic)
  getFromStorage('isDark', isDarkLogic)
})

function updatePauseBtn(paused: boolean) {
  pauseBtn.src = `../assets/${paused ? 'resume' : 'pause'}.svg`
}

function getPauseState() {
  ;(browserAPI as typeof browser).runtime.sendMessage({ action: 'getPause' } as any, (response: any) => {
    updatePauseBtn(response?.isPaused)
  })
}

pauseBtn.addEventListener('click', () => {
  ;(browserAPI as typeof browser).runtime.sendMessage({ action: 'getPause' } as any, (response: any) => {
    const newPause = !response?.isPaused
    ;(browserAPI as typeof browser).runtime.sendMessage({ action: 'setPause', value: newPause } as any, () => {
      updatePauseBtn(newPause)
    })
  })
})

getPauseState()
