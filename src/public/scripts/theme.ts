import { browserAPI } from '../../background'
import { updateChart, settingsIcon } from './ui'
import { colorAlgorithm } from './utils'

let isDark: boolean
let uiHue: number

const themeIcon = document.getElementById('themeIcon') as HTMLImageElement
const hueSlider = document.getElementById('hueSlider') as HTMLInputElement
const hueValue = document.getElementById('hueValue') as HTMLInputElement

export function initTheme() {
  browserAPI.storage.local.get(['isDark', 'uiHue'], (result) => {
    if (result.isDark === undefined) browserAPI.storage.local.set({ isDark: true })
    if (result.uiHue === undefined) browserAPI.storage.local.set({ uiHue: 180 })
  })
}

function updateTheme() {
  const themeConfig = isDark ? { backgroundColor: '#222', textColor: '#fff', rotateValue: 0 } : { backgroundColor: '#eee', textColor: '#000', rotateValue: 180 }
  const filterValue = `invert(${+isDark})`

  document.documentElement.style.setProperty('--background-color', themeConfig.backgroundColor)
  document.documentElement.style.setProperty('--text-color', themeConfig.textColor)
  themeIcon.style.transform = `rotate(${themeConfig.rotateValue}deg)`
  themeIcon.style.filter = filterValue
  settingsIcon.style.filter = filterValue

  updateChart()
}

function updateHue() {
  document.documentElement.style.setProperty('--special-color-dark', colorAlgorithm('dark'))
  document.documentElement.style.setProperty('--special-color-light', colorAlgorithm('light'))
  updateChart()
}

export function getFromStorage(key: string) {
  browserAPI.storage.local.get([key], (result) => {
    console.log(result[key] ? 'Data retrieved:' : 'No data found for key:', key, result[key])

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

    hueSlider.value = uiHue.toString()
    hueValue.value = uiHue.toString()
  })
}

function saveToStorage(key: any, value: any) {
  browserAPI.storage.local.set({ [key]: value }, () => {
    console.log('Data saved:', key, value)
  })
}

themeIcon.addEventListener('click', () => {
  isDark = !isDark
  updateTheme()
  saveToStorage('isDark', isDark)
})

function handleHueChange(event: any) {
  uiHue = parseInt(event.target.value)
  hueSlider.value = uiHue.toString()
  hueValue.value = uiHue.toString()
  updateHue()
  saveToStorage('uiHue', uiHue)
}

hueSlider.addEventListener('input', handleHueChange)
hueValue.addEventListener('input', handleHueChange)

export function getIsDark() {
  return isDark
}

export function getUiHue() {
  return uiHue
}
