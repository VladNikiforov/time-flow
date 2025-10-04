import { browserAPI } from '../../background'
import { updateChart, colorAlgorithm } from './ui'

type ThemePref = 'system' | 'light' | 'dark'

let isDark: boolean = true
let uiHue: number = 210
let themePref: ThemePref = 'system'

// themeSelect is now a container for radio inputs
const themeContainer = document.getElementById('themeSelect') as HTMLDivElement | null
const themeRadios: NodeListOf<HTMLInputElement> | null = themeContainer ? themeContainer.querySelectorAll('input[name="theme"]') : null
const hueSlider = document.getElementById('hueSlider') as HTMLInputElement | null
const hueValue = document.getElementById('hueValue') as HTMLInputElement | null

export function initTheme() {
  browserAPI.storage.local.get(['theme', 'isDark', 'uiHue'], (result) => {
    if (result.theme === undefined) {
      if (result.isDark !== undefined) {
        result.theme = result.isDark ? 'dark' : 'light'
        browserAPI.storage.local.set({ theme: result.theme })
      } else {
        browserAPI.storage.local.set({ theme: 'system' })
        result.theme = 'system'
      }
    }

    if (result.uiHue === undefined) browserAPI.storage.local.set({ uiHue: 210 })

    themePref = result.theme
    applyThemePref()
    // set checked radio based on stored preference
    if (themeRadios) {
      themeRadios.forEach((r) => {
        r.checked = r.value === themePref
      })
    }
    if (typeof result.uiHue === 'number') {
      uiHue = result.uiHue
      if (hueSlider) hueSlider.value = uiHue.toString()
      if (hueValue) hueValue.value = uiHue.toString()
      updateHue()
    } else {
      if (hueSlider) hueSlider.value = uiHue.toString()
      if (hueValue) hueValue.value = uiHue.toString()
    }
  })
}

function updateTheme() {
  document.documentElement.classList.toggle('dark', isDark)
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
      case 'theme':
        themePref = result[key] || 'system'
        applyThemePref()
        if (themeRadios) {
          themeRadios.forEach((r) => {
            r.checked = r.value === themePref
          })
        }
        break
      case 'uiHue':
        if (typeof result[key] === 'number') {
          uiHue = result[key]
          updateHue()
        }
        break
    }

    if (hueSlider && typeof uiHue === 'number') hueSlider.value = uiHue.toString()
    if (hueValue && typeof uiHue === 'number') hueValue.value = uiHue.toString()
  })
}

function saveToStorage(key: any, value: any) {
  browserAPI.storage.local.set({ [key]: value }, () => {
    console.log('Data saved:', key, value)
  })
}

if (themeRadios) {
  themeRadios.forEach((r) => {
    r.addEventListener('change', (e: any) => {
      if (!e.target) return
      themePref = (e.target as HTMLInputElement).value as ThemePref
      saveToStorage('theme', themePref)
      applyThemePref()
    })
  })
}

function applyThemePref() {
  if (themePref === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    isDark = !!prefersDark
  } else {
    isDark = themePref === 'dark'
  }
  if (themePref === 'system' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (ev: MediaQueryListEvent | MediaQueryList) => {
      isDark = !!ev.matches
      updateTheme()
    }
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', handler as any)
    else if (typeof (mq as any).addListener === 'function') (mq as any).addListener(handler)
  }
  updateTheme()
}

function handleHueChange(event: any) {
  const parsed = parseInt(event.target.value)
  uiHue = Number.isFinite(parsed) ? parsed : uiHue
  if (hueSlider) hueSlider.value = uiHue.toString()
  if (hueValue) hueValue.value = uiHue.toString()
  updateHue()
  saveToStorage('uiHue', uiHue)
}

if (hueSlider) hueSlider.addEventListener('input', handleHueChange)
if (hueValue) hueValue.addEventListener('input', handleHueChange)

export function getIsDark() {
  return isDark
}

export function getUiHue() {
  return uiHue
}
