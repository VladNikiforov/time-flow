import { browserAPI } from '../../background'
import { hueSlider, hueValue, themeIcon, updateChart, settingsIcon } from '../script'
import { today } from './utils'

export function loadTheme() {
  browserAPI.storage.local.get(['isDark', 'uiHue'], (result) => {
    if (result.isDark === undefined) browserAPI.storage.local.set({ isDark: true })
    if (result.uiHue === undefined) browserAPI.storage.local.set({ uiHue: 180 })
  })
}

let isDark: boolean
let uiHue: number

export function getFromStorage(key: string) {
  browserAPI.storage.local.get([key], (result) => {
    console.log(!result[key] ? 'No data found for key:' : 'Data retrieved:', key, result[key])

    switch (key) {
      case 'isDark':
        isDark = result[key]
        updateTheme()
        break
      case 'uiHue':
        uiHue = result[key]
        updateHue()
        break
    }

    hueSlider.value = uiHue
    hueValue.value = uiHue
  })
}

export function getHue() {
  return uiHue
}

export function getIsDark() {
  return isDark
}

export function setHue(newValue: number) {
  uiHue = newValue
}

export function toggleTheme() {
  isDark = !isDark
  updateTheme()
  saveToStorage('isDark', isDark)
}

export function updateHue() {
  document.documentElement.style.setProperty('--special-color-dark', colorAlgorithm('dark'))
  document.documentElement.style.setProperty('--special-color-light', colorAlgorithm('light'))
  updateChart()
}

export function handleHueChange(event: any) {
  uiHue = parseInt(event.target.value)
  hueSlider.value = uiHue
  hueValue.value = uiHue
  updateHue()
  saveToStorage('uiHue', uiHue)
}

export function updateTheme() {
  const themeConfig = isDark ? { backgroundColor: '#222', textColor: '#fff', rotateValue: 0 } : { backgroundColor: '#eee', textColor: '#000', rotateValue: 180 }
  const filterValue = `invert(${+isDark})`

  document.documentElement.style.setProperty('--background-color', themeConfig.backgroundColor)
  document.documentElement.style.setProperty('--text-color', themeConfig.textColor)
  themeIcon.style.transform = `rotate(${themeConfig.rotateValue}deg)`
  themeIcon.style.filter = filterValue
  settingsIcon.style.filter = filterValue

  updateChart()
}

export function saveToStorage(key: any, value: any) {
  browserAPI.storage.local.set({ [key]: value }, () => {
    console.log('Data saved:', key, value)
  })
}

export function colorAlgorithm(color: 'dark' | 'light', index = 0) {
  const hue = (getHue() + index * 20) % 360
  const colorFormula = `${hue}, 48%, 52%`
  return color === 'dark' ? `hsla(${colorFormula}, 0.2)` : `hsl(${colorFormula})`
}
