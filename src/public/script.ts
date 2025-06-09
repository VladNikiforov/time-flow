/* MIT License Copyright (c) 2024-2025 @VladNikiforov See the LICENSE file */

declare global {
  interface Window {
    Chart: any
    chartInstance: any
    detailChartInstance: any
  }
}

import Chart from 'chart.js/auto'
import { browserAPI, toLocalISODate, today } from '../background'

let isDark: boolean
let uiHue: number

browserAPI.storage.local.get(['isDark', 'uiHue'], (result) => {
  if (result.isDark === undefined) browserAPI.storage.local.set({ isDark: true })
  if (result.uiHue === undefined) browserAPI.storage.local.set({ uiHue: 180 })
})

function getFromStorage(key: string) {
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

type WebsiteData = {
  website: string
  time: number
}

type RawData = {
  [date: string]: WebsiteData[]
}

const rawData: RawData = {}
browserAPI.runtime.onMessage.addListener(receiveData)
function receiveData(message: any) {
  if (message.action !== 'sendData') {
    console.error('Error receiving data from background.js:', message)
  }

  Object.assign(rawData, message.data)
  console.log('Received data from background.js:', rawData)

  getStartDate()

  getFromStorage('uiHue')
  getFromStorage('isDark')
}

;(browserAPI as typeof browser).runtime.sendMessage({ action: 'requestAllData' })

/*
// Note that this is only sample data
function generateSampleData() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const isoDate = toLocalISODate(date)

    const websites = ['chatgpt', 'chess', 'github', 'google', 'youtube', 'skool', 'chat.deepseek']
    rawData[isoDate] = Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => ({
      website: `https://${websites[Math.floor(Math.random() * websites.length)]}.com`,
      time: Math.floor(Math.random() * 3600) + 60,
    }))
  }

  console.log('Generated mock rawData:', rawData)
}
generateSampleData()
*/

const viewRangeElement = document.querySelectorAll('input[name="viewRange"]') as any
const viewModeElement = document.querySelectorAll('input[name="viewMode"]') as any

type ViewRange = 'Week' | 'Month'
let viewRange: ViewRange = 'Week' as ViewRange

type ViewMode = 'time' | 'sessions'
let viewMode: ViewMode = 'time' as ViewMode

viewRangeElement.forEach((radio: any) => {
  radio.addEventListener('change', () => {
    viewRange = radio.value as ViewRange
    getStartDate()
  })
})

viewModeElement.forEach((radio: any) => {
  radio.addEventListener('change', () => {
    viewMode = radio.value as ViewMode
    updateChart()
  })
})

let currentStartDate: any = null
function getStartDate() {
  const now = new Date()
  currentStartDate = (viewRange === 'Week' ? getStartOfWeek : getStartOfMonth)(now)
  updateChart()
}

function getStartOfWeek(date: Date) {
  const day = date.getDay()
  const difference = date.getDate() - (day === 0 ? 6 : day - 1)
  const startOfWeek = new Date(date)
  startOfWeek.setDate(difference)
  startOfWeek.setHours(0, 0, 0, 0)
  return startOfWeek
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getDaysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

const prevButton = document.getElementById('prevButton') as HTMLButtonElement
const nextButton = document.getElementById('nextButton') as HTMLButtonElement

prevButton.addEventListener('click', () => navigateChart(-1))
nextButton.addEventListener('click', () => navigateChart(1))

function updateChart() {
  const dateRange = generateDateRange(currentStartDate)
  const filledData = fillMissingDates(rawData, dateRange)
  renderMainChart(filledData)
  updateDailyStats(dateRange, filledData)
}

function updateDailyStats(dateRange: any, filledData: any) {
  const simulatedElement = [{ index: dateRange.indexOf(today) }]
  handleChartClick(simulatedElement, dateRange, filledData)
}

const prevDay = document.getElementById('prevDay') as HTMLButtonElement
const nextDay = document.getElementById('nextDay') as HTMLButtonElement

prevDay.addEventListener('click', () => navigateStats(-1))
nextDay.addEventListener('click', () => navigateStats(1))

let currentStatIndex = 0

const dayDateElement = document.getElementById('dayDate') as HTMLElement

function navigateStats(direction: number) {
  const dateRange: string[] = generateDateRange(currentStartDate)
  const filledData = fillMissingDates(rawData, dateRange)

  currentStatIndex += direction
  if (currentStatIndex < 0) currentStatIndex = dateRange.length - 1
  if (currentStatIndex >= dateRange.length) currentStatIndex = 0

  const currentIndex = (dateRange.indexOf(today) + currentStatIndex) % dateRange.length

  dayDateElement.textContent = formatDate(dateRange[currentIndex])

  const simulatedElement = { index: currentIndex }
  handleChartClick([simulatedElement], dateRange, filledData)
}

function navigateChart(direction: number) {
  if (viewRange === 'Week') {
    const date = currentStartDate.getDate()
    currentStartDate.setDate(date + direction * 7)
  } else {
    const year = currentStartDate.getFullYear()
    const month = currentStartDate.getMonth() + direction
    currentStartDate = new Date(year, month, 1)
  }
  updateChart()
}

function generateDateRange(startDate: Date) {
  let dateRange: string[] = []
  if (viewRange === 'Week') {
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      dateRange.push(toLocalISODate(date))
    }
  } else {
    const daysInMonth = getDaysInMonth(startDate)
    for (let i = 0; i < daysInMonth; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth(), i + 1)
      dateRange.push(toLocalISODate(date))
    }
  }
  return dateRange
}

function fillMissingDates(data: RawData, dateRange: string[]) {
  const filledData: any = {}

  dateRange.forEach((date: string) => {
    const entries = data[date] || []
    filledData[date] = entries.length > 0 ? entries : []
  })

  return filledData
}

function formatDate(date: string) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [year, month, day] = date.split('-')
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
}

function formatKey(key: string) {
  key = key
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
  return key.length > 24 ? key.slice(0, 24) + '...' : key
}

function formatValue(value: number) {
  if (viewMode === 'time') {
    const h = Math.floor(value / 3600)
    const m = Math.floor((value % 3600) / 60)
    const s = value % 60

    return h ? `${h}h${m ? ` ${m}m` : ''}${s ? ` ${s}s` : ''}` : m ? `${m}m${s ? ` ${s}s` : ''}` : `${s}s`
  } else if (viewMode === 'sessions') {
    return `${value} session${value === 1 ? '' : 's'}`
  }
}

function renderMainChart(data: RawData) {
  const mainChartCanvas = document.getElementById('mainChart')
  if (window.chartInstance) window.chartInstance.destroy()

  const dates = Object.keys(data)
  const values = getValues(dates, data)

  updateAverage(values)
  createMainChart(mainChartCanvas, dates, values, data)
}

function getValues(dates: any, data: any) {
  return dates.map((date: any) => {
    if (!data[date]) return 0

    if (viewMode === 'time') {
      return data[date].reduce((sum: number, entry: any) => sum + (entry.time || 0), 0)
    } else {
      return data[date].length
    }
  })
}

function getPreviousPeriodRange(currentStartDate: Date): string[] {
  let prevStart: Date
  if (viewRange === 'Week') {
    prevStart = new Date(currentStartDate)
    prevStart.setDate(currentStartDate.getDate() - 7)
    return generateDateRange(prevStart)
  } else {
    prevStart = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth() - 1, 1)
    return generateDateRange(prevStart)
  }
}

function getTotal(values: number[]) {
  return values.reduce((sum, v) => sum + v, 0)
}

function updateAverage(values: any) {
  const averageValue = Math.round(values.reduce((sum: number, time: number) => sum + time, 0) / values.length)
  const averageElement = document.getElementById('averageTime') as HTMLDivElement
  averageElement.textContent = `${viewRange} Average: ${formatValue(averageValue)}`

  const timeTrendElement = document.getElementById('timeTrend') as HTMLSpanElement
  const prevRange = getPreviousPeriodRange(currentStartDate)
  const prevFilled = fillMissingDates(rawData, prevRange)
  const prevValues = getValues(prevRange, prevFilled)
  const prevTotal = getTotal(prevValues)
  const currentTotal = getTotal(values)

  const percent = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 0
  const arrow = percent > 0 ? '↑' : percent < 0 ? '↓' : ''
  const range = viewRange === 'Week' ? 'last week' : 'last month'

  if (prevTotal === 0 || percent === 0) {
    timeTrendElement.textContent = `No ${prevTotal === 0 ? 'data for' : 'change since'}  ${range}`
    timeTrendElement.style.color = '#858585'
  } else {
    timeTrendElement.textContent = `${arrow} ${Math.abs(percent)}% than ${range}`
    timeTrendElement.style.color = `hsl(${percent > 0 ? 1 : 120}, 48%, 52%)`
  }
}

function createMainChart(canvas: any, dates: any, values: any, data: any) {
  const options: any = {
    responsive: true,
    plugins: {
      title: { display: false },
      tooltip: {
        callbacks: {
          title: (context: any) => context[0].label,
          label: (context: any) => formatValue(context.raw),
        },
      },
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: {
          color: isDark ? '#fff' : '#000',
        },
        grid: { color: isDark ? '#ffffff1a' : '#0000001a' },
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatValue(value),
          color: isDark ? '#fff' : '#000',
        },
        grid: { color: isDark ? '#ffffff1a' : '#0000001a' },
      },
    },
    onClick: (_: null, elements: any) => handleChartClick(elements, dates, data),
  }

  window.chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: formatLabels(dates),
      datasets: [
        {
          data: values,
          borderWidth: 1,
          backgroundColor: colorAlgorithm('dark'),
          borderColor: colorAlgorithm('light'),
          maxBarThickness: 100,
        },
      ],
    },
    options: options,
  })
}

function formatLabels(dates: any) {
  return dates.map((date: any) => {
    const d = new Date(date)
    return viewRange === 'Week' ? `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}` : d.getDate()
  })
}

function handleChartClick(elements: any, dates: any, data: any) {
  if (elements.length == 0) return
  const index = elements[0].index
  const label = dates[index]
  const detailChartElement: any = document.getElementById('detailChart')
  renderDetailChart(data[label], detailChartElement.getContext('2d'))
  dayDateElement.textContent = formatDate(label)
}

function renderDetailChart(entries: any, canvas: any) {
  const aggregatedData = aggregateEntries(entries)
  const { websites, values, totalSpentTime } = processAggregatedData(aggregatedData)

  destroyPreviousChart()
  createDetailChart(canvas, websites, values)
  renderProgressBars(websites, values, totalSpentTime)
}

function destroyPreviousChart() {
  if (window.detailChartInstance) {
    window.detailChartInstance.destroy()
  }
}

function aggregateEntries(entries: any) {
  const aggregatedData = entries.reduce((acc: any, entry: any) => {
    const key = entry.website || 'unknown'
    const value = viewMode === 'time' ? entry.time || 0 : 1

    acc[key] = (acc[key] || 0) + value
    return acc
  }, {})

  return Object.fromEntries(Object.entries(aggregatedData).sort((a: any[], b: any[]) => b[1] - a[1]))
}

function processAggregatedData(aggregatedData: any) {
  const websites = Object.keys(aggregatedData)
  const values = Object.values(aggregatedData)
  const totalSpentTime = values.reduce((sum: any, value) => sum + value, 0)
  return { websites, values, totalSpentTime }
}

function colorAlgorithm(color: 'dark' | 'light', index = 0) {
  const hue = (uiHue + index * 20) % 360
  const colorFormula = `${hue}, 48%, 52%`
  return color === 'dark' ? `hsla(${colorFormula}, 0.2)` : `hsl(${colorFormula})`
}

function createDetailChart(canvas: HTMLCanvasElement, websites: any, values: any) {
  const backgroundColors = websites.map((_: any, index: number) => colorAlgorithm('dark', index))
  const borderColors = websites.map((_: any, index: number) => colorAlgorithm('light', index))

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
            label: (context: any) => formatValue(context.raw),
          },
        },
      },
    },
  })
}

const maxItems = 3
function renderProgressBars(websites: any, values: any, totalSpentTime: any) {
  const progressContainer: any = document.getElementById('progressContainer')
  progressContainer.innerHTML = ''

  const entries = websites.map((website: any, index: any) => {
    const percentage = Math.round((values[index] / totalSpentTime) * 100)
    const entryContainer = createProgressEntry(website, values[index], percentage, index)
    progressContainer.appendChild(entryContainer)
    return entryContainer
  })

  if (websites.length > maxItems) {
    const showMoreButton = document.createElement('button')
    showMoreButton.textContent = 'Show All'
    showMoreButton.style.marginRight = '1rem'
    showMoreButton.addEventListener('click', () => {
      entries.slice(maxItems).forEach((entry: any) => {
        entry.classList.remove('hidden')
      })
      showMoreButton.style.display = 'none'
    })
    progressContainer.appendChild(showMoreButton)
  }

  const totalTime = document.getElementById('dayTotal') as HTMLDivElement
  totalTime.textContent = formatValue(totalSpentTime) as string
}

function createProgressEntry(website: string, value: number, percentage: number, index: number) {
  const entryContainer = document.createElement('div')
  entryContainer.classList.add('gridDisplay')

  if (index >= maxItems) {
    entryContainer.classList.add('hidden')
  }

  const labelText = document.createElement('a')
  labelText.classList.add('labelText')
  labelText.target = '_blank'
  labelText.href = website
  labelText.textContent = formatKey(website)
  entryContainer.appendChild(labelText)

  const progressBar = document.createElement('progress')
  progressBar.max = 100
  progressBar.value = percentage
  progressBar.style.setProperty('--progress-bar-background', colorAlgorithm('dark', index))
  progressBar.style.setProperty('--progress-bar-fill', colorAlgorithm('light', index))
  entryContainer.appendChild(progressBar)

  const valueText = document.createElement('div')
  valueText.classList.add('valueText')
  valueText.style.textAlign = 'center'
  valueText.textContent = `${formatValue(value)} (${percentage}%)`
  entryContainer.appendChild(valueText)

  return entryContainer
}

const settingsIcon = document.getElementById('settingsIcon') as HTMLImageElement
const overlay = document.getElementById('overlay') as HTMLDivElement
const popup = document.getElementById('popup') as HTMLDivElement
const closeButton = document.getElementById('closeButton') as HTMLButtonElement
const themeIcon = document.getElementById('themeIcon') as HTMLImageElement
const hueSlider: any = document.getElementById('hueSlider')
const hueValue: any = document.getElementById('hueValue')

function saveToStorage(key: any, value: any) {
  browserAPI.storage.local.set({ [key]: value }, () => {
    console.log('Data saved:', key, value)
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

themeIcon.addEventListener('click', () => {
  isDark = !isDark
  updateTheme()
  saveToStorage('isDark', isDark)
})

type Action = 'open' | 'close'
function togglePopup(action: Action) {
  const actionCheck = action === 'open' ? 'block' : 'none'
  overlay.style.display = actionCheck
  popup.style.display = actionCheck
}

settingsIcon.addEventListener('click', () => togglePopup('open'))
closeButton.addEventListener('click', () => togglePopup('close'))
overlay.addEventListener('click', () => togglePopup('close'))

function updateHue() {
  document.documentElement.style.setProperty('--special-color-dark', colorAlgorithm('dark'))
  document.documentElement.style.setProperty('--special-color-light', colorAlgorithm('light'))
  updateChart()
}

function handleHueChange(event: any) {
  uiHue = parseInt(event.target.value)
  hueSlider.value = uiHue
  hueValue.value = uiHue
  updateHue()
  saveToStorage('uiHue', uiHue)
}

hueSlider.addEventListener('input', handleHueChange)
hueValue.addEventListener('input', handleHueChange)

const dataFormatSelect = document.querySelectorAll('input[name="dataMode"]') as any
const exportDataButton = document.getElementById('exportData') as HTMLButtonElement
const importDataButton = document.getElementById('importData') as HTMLButtonElement

let dataMode: any = 'json'

dataFormatSelect.forEach((radio: any) => {
  radio.addEventListener('change', () => {
    dataMode = radio.value as any
  })
})

const importFileInput = document.createElement('input')
importFileInput.type = 'file'
importFileInput.accept = '.json,application/json,.csv,text/csv'
importFileInput.style.display = 'none'
document.body.appendChild(importFileInput)

exportDataButton.addEventListener('click', () => {
  if (dataMode === 'json') {
    const blob = new Blob([JSON.stringify(rawData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TimeFlow Export ${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  } else if (dataMode === 'csv') {
    const rows = [['date', 'website', 'time']]
    for (const date in rawData) {
      for (const entry of rawData[date]) {
        rows.push([date, entry.website, entry.time.toString()])
      }
    }
    const csvContent = rows.map((r) => r.map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TimeFlow Export ${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
})

importDataButton.addEventListener('click', () => importFileInput.click())
importFileInput.addEventListener('change', (event: any) => {
  const file = event.target.files[0]
  if (!file) return
  const format = dataFormatSelect.value
  const reader = new FileReader()
  reader.onload = (e: any) => {
    try {
      Object.keys(rawData).forEach((key) => delete rawData[key])
      if (format === 'json') {
        const importedData = JSON.parse(e.target.result)
        Object.assign(rawData, importedData)
      } else if (format === 'csv') {
        const text = e.target.result as string
        const lines = text.trim().split('\n')
        const header = lines.shift()
        if (!header || !header.toLowerCase().includes('date')) throw new Error('Invalid CSV header')
        for (const line of lines) {
          const [date, website, time] = line.split(',').map((s) => s.replace(/^"|"$/g, '').replace(/""/g, '"'))
          if (!date || !website || isNaN(Number(time))) continue
          if (!rawData[date]) rawData[date] = []
          rawData[date].push({ website, time: Number(time) })
        }
      }
      updateChart()
      alert('Data imported successfully!')
    } catch (err) {
      alert('Failed to import data')
    }
  }
  reader.readAsText(file)
})
