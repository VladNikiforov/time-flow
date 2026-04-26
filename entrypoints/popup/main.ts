/* TimeFlow - browser extension; (c) 2024 VladNikiforov; GPLv3, see LICENSE file */

import '../../assets/style.css'
import Chart from 'chart.js/auto'
import { parse as parseDomain } from 'tldts'
import { RawData, FullData } from '../../utils/types'

declare global {
  interface Window {
    Chart: typeof Chart
    detailChartInstance: Chart
  }
}

function getDomain(url: string): string {
  try {
    const parsed = parseDomain(url)
    if (parsed.domain && parsed.publicSuffix) {
      return parsed.hostname as string
    }
  } catch {}
  return url
}

function formatValue(value: number | { start: number; end: number }) {
  let seconds: number
  if (typeof value === 'number') {
    seconds = value
  } else if (typeof value === 'object' && value.start != null && value.end != null) {
    seconds = Math.floor((value.end - value.start) / 1000)
  } else {
    seconds = 0
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}${s ? ` ${s}s` : ''}` : m ? `${m}m${s ? ` ${s}s` : ''}` : `${s}s`
}

function processAggregatedData(aggregatedData: Record<string, number>) {
  const websites = Object.keys(aggregatedData)
  const values = Object.values(aggregatedData)
  const totalSpentTime = values.reduce((sum, value) => sum + value, 0)
  return { websites, values, totalSpentTime }
}

function aggregateEntries(entries: RawData[]): Record<string, number> {
  function getSeconds(time: number | { start: number; end: number }): number {
    if (typeof time === 'number') return time
    if (typeof time === 'object' && time.start != null && time.end != null) return Math.floor((time.end - time.start) / 1000)
    return 0
  }
  const aggregatedData = entries.reduce((acc: Record<string, number>, entry: RawData) => {
    const rawUrl = entry.website || 'unknown'
    const key = getDomain(rawUrl)
    const value = getSeconds(entry.time)
    acc[key] = (acc[key] || 0) + value
    return acc
  }, {})
  return Object.fromEntries(Object.entries(aggregatedData).sort((a, b) => b[1] - a[1]))
}

const fullData: FullData = {}

let uiHue = 210 // default

browser.runtime.onMessage.addListener((message: any) => {
  if (message.action !== 'sendData') return
  console.log('Received sendData message:', message)

  Object.assign(fullData, message.data)
  updatePopup()
})

const pageButton = document.getElementById('main-page') as HTMLButtonElement
const pauseBtn = document.getElementById('pause') as HTMLImageElement

if (pageButton) {
  pageButton.addEventListener('click', () => {
    browser.tabs.create({ url: '/main.html' })
  })
}

function getFromStorage(key: any, callback: any) {
  browser.storage.local.get([key]).then((result) => {
    const value = result[key]
    console.log(key === undefined ? 'No data found for key:' : 'Data retrieved:', key, value)
    callback(value)
  })
}

function uiHueLogic(uiHueValue: number) {
  uiHue = uiHueValue || 210
  type Theme = 'light' | 'dark'
  function colorAlgorithm(theme: Theme) {
    const colorFormula = `${uiHue}, 48%, 52%`
    return theme === 'dark' ? `hsla(${colorFormula}, 0.2)` : `hsl(${colorFormula})`
  }

  if (pageButton) {
    pageButton.style.backgroundColor = colorAlgorithm('dark')
    pageButton.style.borderColor = colorAlgorithm('light')
  }
}

function colorAlgorithm(color: 'dark' | 'light', index = 0): string {
  const hue = (uiHue + index * 20) % 360
  const colorFormula = `${hue}, 48%, 52%`
  return color === 'dark' ? `hsla(${colorFormula}, 0.2)` : `hsl(${colorFormula})`
}

function applyThemePref(pref: any) {
  const theme: 'system' | 'light' | 'dark' = pref || 'system'
  if (theme === 'system' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', prefersDark)
  } else {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}

document.addEventListener('DOMContentLoaded', () => {
  getFromStorage('uiHue', uiHueLogic)
  getFromStorage('theme', applyThemePref)
  browser.runtime.sendMessage({ action: 'requestAllData' })
})

function updatePauseBtn(paused: boolean) {
  if (pauseBtn) {
    // In WXT, assets in public/ are served from the root
    pauseBtn.src = `/${paused ? 'resume' : 'pause'}.svg`
  }
}

function getPauseState() {
  browser.runtime.sendMessage({ action: 'getPause' }).then((response: any) => {
    updatePauseBtn(response?.isPaused)
  })
}

if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ action: 'getPause' }).then((response: any) => {
      const newPause = !response?.isPaused
      browser.runtime.sendMessage({ action: 'setPause', value: newPause }).then(() => {
        updatePauseBtn(newPause)
      })
    })
  })
}

getPauseState()

function updatePopup() {
  // @ts-ignore
  const entries = fullData[today] || []
  renderDetailChart(entries)
}

function renderDetailChart(entries: RawData[]) {
  const aggregatedData = aggregateEntries(entries)
  const { websites, values, totalSpentTime } = processAggregatedData(aggregatedData)

  const detailChart = document.getElementById('detailChart') as HTMLCanvasElement
  if (!detailChart) return
  const canvas = detailChart.getContext('2d')
  if (!canvas) return

  // Destroy previous chart if exists
  if (window.detailChartInstance) {
    window.detailChartInstance.destroy()
  }

  createDetailChart(canvas, websites, values)

  const dayTotal = document.getElementById('dayTotal') as HTMLDivElement
  if (dayTotal) {
    dayTotal.textContent = formatValue(totalSpentTime) as string
  }
}

function createDetailChart(canvas: CanvasRenderingContext2D, websites: string[], values: number[]) {
  const backgroundColors = websites.map((_, index) => colorAlgorithm('dark', index))
  const borderColors = websites.map((_, index) => colorAlgorithm('light', index))

  window.detailChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: websites,
      datasets: [
        {
          data: values,
          borderWidth: 1,
          borderRadius: 8,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
        },
      ],
    },
    options: {
      responsive: true,
      cutout: '40%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // @ts-ignore
            label: (context: any) => formatValue(context.raw),
          },
        },
      },
    },
  })
}
