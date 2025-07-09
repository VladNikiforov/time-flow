import { formatDate, formatValue, getValues, getTotal, formatLabels, colorAlgorithm, processAggregatedData, formatKey } from './utils'
import { getIsDark } from './theme'
import { getStartDate, navigateChart, getCurrentStartDate, generateDateRange, fillMissingDates, getPreviousPeriodRange } from './date'
import { rawData, WebsiteData, RawData } from '../main'
import { today } from '../../background'
import Chart from 'chart.js/auto'

declare global {
  interface Window {
    Chart: Chart
    chartInstance: Chart
    detailChartInstance: Chart
  }
}

const viewRangeElement = document.querySelectorAll('input[name="viewRange"]') as NodeListOf<HTMLInputElement>
const viewModeElement = document.querySelectorAll('input[name="viewMode"]') as NodeListOf<HTMLInputElement>

type ViewRange = 'Week' | 'Month'
export let viewRange: ViewRange = 'Week'

type ViewMode = 'time' | 'sessions'
let viewMode: ViewMode = 'time'

viewRangeElement.forEach((radio: HTMLInputElement) => {
  radio.addEventListener('change', () => {
    viewRange = radio.value as ViewRange
    getStartDate()
  })
})

viewModeElement.forEach((radio: HTMLInputElement) => {
  radio.addEventListener('change', () => {
    viewMode = radio.value as ViewMode
    updateChart()
  })
})

export function getViewRange(): ViewRange {
  return viewRange
}

export function getViewMode(): ViewMode {
  return viewMode
}

const prevButton = document.getElementById('prevButton') as HTMLButtonElement
const nextButton = document.getElementById('nextButton') as HTMLButtonElement

prevButton.addEventListener('click', () => navigateChart(-1))
nextButton.addEventListener('click', () => navigateChart(1))

export function updateChart() {
  const dateRange = generateDateRange(getCurrentStartDate())
  const filledData = fillMissingDates(rawData, dateRange)
  renderMainChart(filledData)
  updateDailyStats(dateRange, filledData)
}

function updateDailyStats(dateRange: string[], filledData: RawData) {
  const simulatedElement = [{ index: dateRange.indexOf(today) }]
  handleChartClick(simulatedElement, dateRange, filledData)
}

const prevDay = document.getElementById('prevDay') as HTMLButtonElement
const nextDay = document.getElementById('nextDay') as HTMLButtonElement

prevDay.addEventListener('click', () => navigateStats(-1))
nextDay.addEventListener('click', () => navigateStats(1))

const dayDateElement = document.getElementById('dayDate') as HTMLElement

let currentStatIndex = 0
export function navigateStats(direction: number) {
  const dateRange: string[] = generateDateRange(getCurrentStartDate())
  const filledData = fillMissingDates(rawData, dateRange)

  currentStatIndex += direction
  if (currentStatIndex < 0) currentStatIndex = dateRange.length - 1
  if (currentStatIndex >= dateRange.length) currentStatIndex = 0

  const currentIndex = (dateRange.indexOf(today) + currentStatIndex) % dateRange.length

  dayDateElement.textContent = formatDate(dateRange[currentIndex])

  const simulatedElement = { index: currentIndex }
  handleChartClick([simulatedElement], dateRange, filledData)
}

export function renderMainChart(data: RawData) {
  const mainChartCanvas = document.getElementById('mainChart') as HTMLCanvasElement
  if (window.chartInstance) window.chartInstance.destroy()

  const dates = Object.keys(data)
  const values = getValues(dates, data)

  updateAverage(values)
  createMainChart(mainChartCanvas, dates, values, data)
}

export function updateAverage(values: any) {
  const averageValue = Math.round(values.reduce((sum: number, time: number) => sum + time, 0) / values.length)
  const averageElement = document.getElementById('averageTime') as HTMLDivElement
  averageElement.textContent = `${getViewRange()} Average: ${formatValue(averageValue)}`

  const timeTrendElement = document.getElementById('timeTrend') as HTMLSpanElement
  const prevRange = getPreviousPeriodRange(getCurrentStartDate())
  const prevFilled = fillMissingDates(rawData, prevRange)
  const prevValues = getValues(prevRange, prevFilled)
  const prevTotal = getTotal(prevValues)
  const currentTotal = getTotal(values)

  const percent = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 0
  const arrow = percent > 0 ? '↑' : percent < 0 ? '↓' : ''
  const range = getViewRange() === 'Week' ? 'last week' : 'last month'

  if (prevTotal === 0 || percent === 0) {
    timeTrendElement.textContent = `No ${prevTotal === 0 ? 'data for' : 'change since'}  ${range}`
    timeTrendElement.style.color = '#858585'
  } else {
    timeTrendElement.textContent = `${arrow} ${Math.abs(percent)}% than ${range}`
    timeTrendElement.style.color = `hsl(${percent > 0 ? 1 : 120}, 48%, 52%)`
  }
}

export function createMainChart(canvas: HTMLCanvasElement | null, dates: string[], values: number[], data: RawData) {
  if (!canvas) return
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
          color: getIsDark() ? '#fff' : '#000',
        },
        grid: { color: getIsDark() ? '#ffffff1a' : '#0000001a' },
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatValue(value),
          color: getIsDark() ? '#fff' : '#000',
        },
        grid: { color: getIsDark() ? '#ffffff1a' : '#0000001a' },
      },
    },
    onClick: (_: unknown, elements: Array<{ index: number }>) => handleChartClick(elements, dates, data),
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

export function handleChartClick(elements: Array<{ index: number }>, dates: string[], data: RawData) {
  if (elements.length == 0) return
  const index = elements[0].index
  const label = dates[index]
  const detailChartElement = document.getElementById('detailChart') as HTMLCanvasElement
  renderDetailChart(data[label], detailChartElement.getContext('2d'))
  dayDateElement.textContent = formatDate(label)
}

function renderDetailChart(entries: WebsiteData[], canvas: CanvasRenderingContext2D | null) {
  if (!canvas) return
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

function aggregateEntries(entries: WebsiteData[]): Record<string, number> {
  const aggregatedData = entries.reduce((acc: Record<string, number>, entry: WebsiteData) => {
    const key = entry.website || 'unknown'
    const value = getViewMode() === 'time' ? entry.time || 0 : 1

    acc[key] = (acc[key] || 0) + value
    return acc
  }, {})

  return Object.fromEntries(Object.entries(aggregatedData).sort((a, b) => b[1] - a[1]))
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
            label: (context: any) => formatValue(context.raw),
          },
        },
      },
    },
  })
}

const maxItems = 3
function renderProgressBars(websites: string[], values: number[], totalSpentTime: number) {
  const progressContainer = document.getElementById('progressContainer') as HTMLDivElement
  progressContainer.innerHTML = ''

  const entries = websites.map((website, index) => {
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
      entries.slice(maxItems).forEach((entry) => {
        entry.classList.remove('hidden')
      })
      showMoreButton.style.display = 'none'
    })
    progressContainer.appendChild(showMoreButton)
  }

  const totalTime = document.getElementById('dayTotal') as HTMLDivElement
  totalTime.textContent = formatValue(totalSpentTime) as string
}

function createProgressEntry(website: string, value: number, percentage: number, index: number): HTMLDivElement {
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

export const settingsIcon = document.getElementById('settingsIcon') as HTMLImageElement
const overlay = document.getElementById('overlay') as HTMLDivElement
const popup = document.getElementById('popup') as HTMLDivElement
const closeButton = document.getElementById('closeButton') as HTMLButtonElement

type Action = 'open' | 'close'
function togglePopup(action: Action) {
  const actionCheck = action === 'open' ? 'block' : 'none'
  overlay.style.display = actionCheck
  popup.style.display = actionCheck
}

settingsIcon.addEventListener('click', () => togglePopup('open'))
closeButton.addEventListener('click', () => togglePopup('close'))
overlay.addEventListener('click', () => togglePopup('close'))

const dataFormatSelect = document.querySelectorAll('input[name="dataMode"]') as any
const exportDataButton = document.getElementById('exportData') as HTMLButtonElement
const importDataButton = document.getElementById('importData') as HTMLButtonElement

type DataMode = 'csv' | 'json'

let dataMode: DataMode = 'json'
dataFormatSelect.forEach((radio: HTMLInputElement) => {
  radio.addEventListener('change', () => {
    dataMode = radio.value as DataMode
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
  const reader = new FileReader()
  reader.onload = (e: any) => {
    try {
      Object.keys(rawData).forEach((key) => delete rawData[key])
      if (dataMode === 'json') {
        const importedData = JSON.parse(e.target.result)
        Object.assign(rawData, importedData)
      } else if (dataMode === 'csv') {
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
