import { browserAPI } from '../../background'
import { updateChart, colorAlgorithm } from './ui'

let isDark: boolean
let uiHue: number

const themeIcon = document.getElementById('themeIcon') as HTMLImageElement
const hueSlider = document.getElementById('hueSlider') as HTMLInputElement
const hueValue = document.getElementById('hueValue') as HTMLInputElement

export function initTheme() {
  browserAPI.storage.local.get(['isDark', 'uiHue'], (result) => {
    if (result.isDark === undefined) browserAPI.storage.local.set({ isDark: true })
    if (result.uiHue === undefined) browserAPI.storage.local.set({ uiHue: 210 })
  })
}

function updateTheme() {
  document.documentElement.classList.toggle('dark')
  themeIcon.style.transform = `rotate(${isDark ? 0 : 180}deg)`

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
